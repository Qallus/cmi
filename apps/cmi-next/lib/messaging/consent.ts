import { getSupabaseAdmin } from "@/lib/supabase/server";

export type Channel = "sms" | "email";
export type ConsentAction = "opt_in" | "opt_out";

/**
 * Message categories are tracked separately, per A2P 10DLC guidance: consent to
 * project/service messaging never implies consent to marketing, and a
 * marketing opt-out must not silence transactional messages.
 */
export type ConsentCategory = "service" | "marketing";

/** Bump when the consent disclosure copy changes, so stored records stay reproducible. */
export const CONSENT_DISCLOSURE_VERSION = "2026-07-22";

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

/**
 * Is this address blocked for the channel?
 *
 * `category` defaults to "service" so every existing transactional caller keeps
 * its current behaviour — only a full opt-out blocks it. Pass "marketing" for
 * campaigns, newsletters, and scheduled promotional sends: those are also
 * blocked by the narrower marketing-only opt-out.
 */
export async function isSuppressed(
  channel: Channel,
  address: string,
  category: ConsentCategory = "service",
): Promise<boolean> {
  const addr = normalizeAddress(channel, address);
  if (!addr) return false;
  const { data } = await getSupabaseAdmin()
    .from("messaging_suppressions")
    .select("opted_out, marketing_opted_out")
    .eq("channel", channel)
    .eq("address", addr)
    .maybeSingle();
  if (data?.opted_out === true) return true;
  return category === "marketing" && data?.marketing_opted_out === true;
}

/** Convenience wrapper for campaign / scheduled marketing sends. */
export function isMarketingSuppressed(channel: Channel, address: string): Promise<boolean> {
  return isSuppressed(channel, address, "marketing");
}

/** Identity details captured alongside a consent action, for the audit record. */
export type ConsentPersonInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  relationship?: string | null;
};

export type ConsentAudit = {
  /** Full URL of the page the consent was captured on. */
  sourceUrl?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Verbatim disclosure text shown at the moment of consent. */
  disclosureText?: string | null;
  disclosureVersion?: string | null;
};

/**
 * Record a consent decision.
 *
 * `categories` says which message categories the action covers:
 *   - opt_in  ["service","marketing"] → allowed on both
 *   - opt_in  ["service"]             → service allowed, marketing suppressed
 *                                       (marketing consent is never inferred)
 *   - opt_out ["service","marketing"] → full stop on the channel
 *   - opt_out ["marketing"]           → marketing only; transactional continues
 *
 * Writes the current state to messaging_suppressions and appends an immutable
 * row to messaging_consent_events as the audit record.
 */
export async function applyConsent(input: {
  channel: Channel;
  action: ConsentAction;
  address: string;
  source: string;
  categories?: ConsentCategory[];
  recordType?: string;
  recordId?: string | null;
  actorStaffId?: string | null;
  contactId?: string | null;
  person?: ConsentPersonInput;
  audit?: ConsentAudit;
  optOutMethod?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; address: string } | { error: string }> {
  const addr = normalizeAddress(input.channel, input.address);
  if (!addr) return { error: "A valid address is required." };

  // Default to both categories, which preserves the old all-or-nothing behaviour
  // for existing callers that don't specify.
  const categories: ConsentCategory[] = input.categories?.length
    ? input.categories
    : ["service", "marketing"];
  const coversService = categories.includes("service");
  const coversMarketing = categories.includes("marketing");
  const optingOut = input.action === "opt_out";
  const now = new Date().toISOString();

  const sb = getSupabaseAdmin();

  // A full-channel stop requires the service category; a marketing-only opt-out
  // must leave transactional messaging intact.
  const optedOut = optingOut && coversService;
  // On opt-in, marketing is allowed only when explicitly selected — never inferred.
  const marketingOptedOut = optingOut ? coversMarketing : !coversMarketing;

  const { error: upErr } = await sb.from("messaging_suppressions").upsert({
    channel: input.channel,
    address: addr,
    opted_out: optedOut,
    marketing_opted_out: marketingOptedOut,
    opted_out_at: optedOut ? now : null,
    marketing_opted_out_at: marketingOptedOut ? now : null,
    opt_out_method: optingOut ? (input.optOutMethod ?? input.source) : null,
    source: input.source,
    updated_at: now,
  }, { onConflict: "channel,address" });
  if (upErr) return { error: upErr.message };

  const { error: evErr } = await sb.from("messaging_consent_events").insert({
    channel: input.channel,
    action: input.action,
    address: addr,
    categories,
    record_type: input.recordType ?? null,
    record_id: input.recordId ?? null,
    contact_id: input.contactId ?? null,
    source: input.source,
    actor_staff_id: input.actorStaffId ?? null,
    first_name: input.person?.firstName ?? null,
    last_name: input.person?.lastName ?? null,
    email: input.person?.email ?? null,
    phone: input.person?.phone ?? null,
    company: input.person?.company ?? null,
    relationship: input.person?.relationship ?? null,
    source_url: input.audit?.sourceUrl ?? null,
    ip: input.audit?.ip ?? null,
    user_agent: input.audit?.userAgent ?? null,
    disclosure_text: input.audit?.disclosureText ?? null,
    disclosure_version: input.audit?.disclosureVersion ?? CONSENT_DISCLOSURE_VERSION,
    metadata: input.metadata ?? {},
  });
  // The suppression state is what governs sending; a failed audit insert should
  // surface rather than silently leaving an unlogged consent change.
  if (evErr) return { error: evErr.message };

  return { ok: true, address: addr };
}

// ── CRM linkage ──────────────────────────────────────────────────────────────

/**
 * The consent forms offer a richer relationship list than `contacts.type`
 * allows (it has a CHECK constraint). Map onto the permitted vocabulary; the
 * verbatim answer is preserved on the consent event either way.
 */
const RELATIONSHIP_TO_CONTACT_TYPE: Record<string, string> = {
  "Prospective Client": "Prospect",
  "Client": "Client",
  "Property Owner": "Client",
  "General Contractor": "Other",
  "Subcontractor": "Sub Contractor",
  "Designer": "Designer",
  "Architect": "Other",
  "Engineer": "Other",
  "Consultant": "Other",
  "Vendor": "Vendor",
  "Supplier": "Vendor",
  "Government or Permit Representative": "Other",
  "Other": "Other",
};

/**
 * Attach a consent submission to the CRM.
 *
 * Matches an existing contact by email, else by phone. Creates one only when an
 * email is present, because `contacts.email` is NOT NULL — an SMS-only opt-in
 * with no email is still recorded in messaging_consent_events, just without a
 * contact link. Never overwrites existing contact fields with blanks.
 */
export async function linkConsentToContact(person: ConsentPersonInput): Promise<string | null> {
  const email = person.email ? normalizeAddress("email", person.email) : "";
  const phone = person.phone ? normalizeAddress("sms", person.phone) : "";
  if (!email && !phone) return null;

  const sb = getSupabaseAdmin();

  if (email) {
    const { data } = await sb.from("contacts").select("id, phone, company").ilike("email", email).limit(1).maybeSingle();
    if (data?.id) {
      const patch: Record<string, unknown> = { last_activity: new Date().toISOString() };
      if (!data.phone && person.phone) patch.phone = person.phone;
      if (!data.company && person.company) patch.company = person.company;
      await sb.from("contacts").update(patch).eq("id", data.id);
      return data.id;
    }
  }

  if (phone) {
    // Compare on digits only — stored numbers are not consistently formatted.
    const { data: rows } = await sb.from("contacts").select("id, phone").not("phone", "is", null).limit(2000);
    const match = (rows ?? []).find((r) => normalizeAddress("sms", r.phone as string) === phone);
    if (match?.id) {
      await sb.from("contacts").update({ last_activity: new Date().toISOString() }).eq("id", match.id);
      return match.id;
    }
  }

  if (!email) return null; // contacts.email is NOT NULL

  const { data: created, error } = await sb
    .from("contacts")
    .insert({
      first_name: person.firstName || "Unknown",
      last_name: person.lastName || "",
      email,
      phone: person.phone || null,
      company: person.company || null,
      type: person.relationship ? (RELATIONSHIP_TO_CONTACT_TYPE[person.relationship] ?? "Other") : null,
      status: "active",
      source: "consent_page",
      last_activity: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[consent] contact create failed", error.message);
    return null;
  }
  return created?.id ?? null;
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
