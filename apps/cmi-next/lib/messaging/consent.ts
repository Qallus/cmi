import { getSupabaseAdmin } from "@/lib/supabase/server";

export type Channel = "sms" | "email";
export type ConsentAction = "opt_in" | "opt_out";

export function normalizeAddress(channel: Channel, raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (channel === "email") return v.toLowerCase();
  let d = v.replace(/\D/g, "");
  if (d.length === 10) d = "1" + d;          // assume US if 10 digits
  return d;
}

export function looksValid(channel: Channel, raw: string): boolean {
  const a = normalizeAddress(channel, raw);
  if (channel === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);
  return a.length >= 10;
}

// Is this address blocked for the channel?
export async function isSuppressed(channel: Channel, address: string): Promise<boolean> {
  const addr = normalizeAddress(channel, address);
  if (!addr) return false;
  const { data } = await getSupabaseAdmin()
    .from("messaging_suppressions")
    .select("opted_out")
    .eq("channel", channel)
    .eq("address", addr)
    .maybeSingle();
  return data?.opted_out === true;
}

export async function applyConsent(input: {
  channel: Channel;
  action: ConsentAction;
  address: string;
  source: string;
  recordType?: string;
  recordId?: string | null;
  actorStaffId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; address: string } | { error: string }> {
  const addr = normalizeAddress(input.channel, input.address);
  if (!addr) return { error: "A valid address is required." };
  const sb = getSupabaseAdmin();

  const { error: upErr } = await sb.from("messaging_suppressions").upsert({
    channel: input.channel,
    address: addr,
    opted_out: input.action === "opt_out",
    source: input.source,
    updated_at: new Date().toISOString(),
  }, { onConflict: "channel,address" });
  if (upErr) return { error: upErr.message };

  await sb.from("messaging_consent_events").insert({
    channel: input.channel,
    action: input.action,
    address: addr,
    record_type: input.recordType ?? null,
    record_id: input.recordId ?? null,
    source: input.source,
    actor_staff_id: input.actorStaffId ?? null,
    metadata: input.metadata ?? {},
  });

  return { ok: true, address: addr };
}

// ── Dashboard aggregation ────────────────────────────────────────────────────

export type ConsentPerson = {
  recordType: "contact" | "user" | "lead";
  recordId: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsOptedOut: boolean | null;   // null = no phone
  emailOptedOut: boolean | null; // null = no email
};

export type ConsentSummary = {
  people: ConsentPerson[];
  counts: {
    smsOptedIn: number; smsOptedOut: number;
    emailOptedIn: number; emailOptedOut: number;
  };
};

export async function loadConsentSummary(): Promise<ConsentSummary> {
  const sb = getSupabaseAdmin();
  const [contactsRes, usersRes, leadsRes, supRes] = await Promise.all([
    sb.from("contacts").select("id, first_name, last_name, email, phone").limit(2000),
    sb.from("staff_users").select("id, display_name, email, phone").in("status", ["active", "invited", "pending"]).limit(1000),
    sb.from("business_card_leads").select("id, name, email, phone").limit(2000),
    sb.from("messaging_suppressions").select("channel, address, opted_out"),
  ]);

  const smsOut = new Set<string>();
  const emailOut = new Set<string>();
  for (const s of supRes.data ?? []) {
    if (!s.opted_out) continue;
    if (s.channel === "sms") smsOut.add(s.address);
    else if (s.channel === "email") emailOut.add(s.address);
  }

  const people: ConsentPerson[] = [];
  const push = (recordType: ConsentPerson["recordType"], recordId: string, name: string, email: string | null, phone: string | null) => {
    const e = email ? normalizeAddress("email", email) : "";
    const p = phone ? normalizeAddress("sms", phone) : "";
    people.push({
      recordType, recordId, name: name || email || phone || "Unknown", email: email || null, phone: phone || null,
      smsOptedOut: p ? smsOut.has(p) : null,
      emailOptedOut: e ? emailOut.has(e) : null,
    });
  };

  for (const c of contactsRes.data ?? []) push("contact", c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), c.email, c.phone);
  for (const u of usersRes.data ?? []) push("user", u.id, u.display_name ?? "", u.email, u.phone);
  for (const l of leadsRes.data ?? []) push("lead", l.id, l.name ?? "", l.email, l.phone);

  let smsIn = 0, smsOff = 0, emailIn = 0, emailOff = 0;
  for (const p of people) {
    if (p.smsOptedOut === true) smsOff++; else if (p.smsOptedOut === false) smsIn++;
    if (p.emailOptedOut === true) emailOff++; else if (p.emailOptedOut === false) emailIn++;
  }

  return { people, counts: { smsOptedIn: smsIn, smsOptedOut: smsOff, emailOptedIn: emailIn, emailOptedOut: emailOff } };
}
