// Recipients, sending and history for executive summaries. Server only.
//
// Guard rails: a TEAM summary (budget, internal notes, risks) can only go to
// active CMI staff — never a typed-in address. A CLIENT summary can only go to
// the client contacts on that Job / Pre-Con record (plus any extra addresses
// the sender types, since its content is client-safe), and only roles that
// talk to clients may send it.
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { sendEmail, sendSms } from "@/lib/messaging/send";
import { logMessage } from "@/lib/communications/data";
import { isSuppressed } from "@/lib/messaging/consent";
import { publicAppUrl } from "@/lib/twilio";
import { createJobUpdate } from "@/lib/job-updates/data";
import { htmlToText } from "@/lib/notes/html";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";
import { summaryDocumentHtml } from "./render";
import type { Audience, SummaryTarget } from "./snapshot";
import type { ComingSoon, SummaryFact } from "./generate";

export const SUMMARY_ROLES = ["super_admin", "admin", "project_manager", "estimator", "staff", "designer", "superintendent"];
export const CLIENT_SEND_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export type Recipient = { id: string; name: string; firstName: string | null; email: string | null; phone?: string | null; onRecord?: boolean };

export type SummaryChannel = "email" | "sms";

/** E.164 for Twilio: "(480) 352-7598" → "+14803527598". Null if it isn't a usable number. */
export function toE164(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Public link to a sent client summary (the id is a random UUID). `reader` is
 * that recipient's own key, so the page greets them by first name.
 */
export const summaryLink = (summaryId: string, reader?: string | null) =>
  `${publicAppUrl()}/summary/${summaryId}${reader ? `?r=${encodeURIComponent(reader)}` : ""}`;

export async function loadRecipients(target: SummaryTarget, id: string): Promise<{ staff: Recipient[]; contacts: Recipient[] }> {
  const sb = getSupabaseAdmin();
  const people = await loadAssignableStaff();
  const onRecord = new Set<string>();
  const contacts: Recipient[] = [];
  const name = (c: { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null }) =>
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "Contact";

  if (target === "job") {
    const [{ data: users }, { data: jcs }] = await Promise.all([
      sb.from("job_internal_users").select("staff_user_id").eq("job_id", id),
      sb.from("job_contacts").select("role,contact:contacts(id,first_name,last_name,company,email,phone)").eq("job_id", id),
    ]);
    for (const u of users ?? []) if (u.staff_user_id) onRecord.add(u.staff_user_id as string);
    for (const row of (jcs ?? []) as unknown as { role: string; contact: { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null } | null }[]) {
      if (row.contact && row.role === "client") contacts.push({ id: row.contact.id, name: name(row.contact), firstName: row.contact.first_name, email: row.contact.email, phone: row.contact.phone });
    }
  } else {
    const { data: o } = await sb.from("pipeline_opportunities").select("contact_id,assigned_owner_id").eq("id", id).maybeSingle();
    if (o?.assigned_owner_id) onRecord.add(o.assigned_owner_id as string);
    if (o?.contact_id) {
      const { data: c } = await sb.from("contacts").select("id,first_name,last_name,company,email,phone").eq("id", o.contact_id).maybeSingle();
      if (c) contacts.push({ id: c.id as string, name: name(c), firstName: (c.first_name as string) ?? null, email: (c.email as string) ?? null, phone: (c.phone as string) ?? null });
    }
  }
  const staff = people.map((p) => ({ id: p.id, name: p.name, firstName: p.name.split(/\s+/)[0] || null, email: p.email, onRecord: onRecord.has(p.id) }))
    .sort((a, b) => Number(b.onRecord) - Number(a.onRecord) || a.name.localeCompare(b.name));
  return { staff, contacts };
}

export type SendInput = {
  target: SummaryTarget;
  id: string;
  audience: Audience;
  headline: string;
  opening: string;
  facts: SummaryFact[];
  completed: string[];
  coming_soon: ComingSoon[];
  photos: { url: string; caption: string | null }[];
  body_html: string;
  note?: string | null;
  /** Email sends the full document; SMS sends a link to it (client summaries only). */
  channel?: SummaryChannel;
  staff_ids?: string[];
  contact_ids?: string[];
  extra_emails?: string[];
  extra_phones?: string[];
  post_to_portal?: boolean;
};

export async function projectInfo(target: SummaryTarget, id: string): Promise<{ name: string; number: string | null; kind: "Job" | "Pre-Con" } | null> {
  const sb = getSupabaseAdmin();
  if (target === "job") {
    const { data } = await sb.from("jobs").select("job_name,job_number").eq("id", id).maybeSingle();
    return data ? { name: data.job_name as string, number: (data.job_number as string) ?? null, kind: "Job" } : null;
  }
  const { data } = await sb.from("pipeline_opportunities").select("opportunity_name,job_number").eq("id", id).maybeSingle();
  return data ? { name: data.opportunity_name as string, number: (data.job_number as string) ?? null, kind: "Pre-Con" } : null;
}

export async function sendSummary(input: SendInput, actor: { id: string; name: string; role: string }) {
  if (input.audience === "client" && !CLIENT_SEND_ROLES.includes(actor.role)) {
    throw Object.assign(new Error(`Your role (${actor.role}) can't send summaries to clients.`), { status: 403 });
  }
  const headline = input.headline?.trim().slice(0, 200);
  if (!headline) throw Object.assign(new Error("The summary needs a headline."), { status: 400 });
  const body = sanitizeHtmlServer(input.body_html);
  if (!htmlToText(body)) throw Object.assign(new Error("The summary is empty."), { status: 400 });
  const project = await projectInfo(input.target, input.id);
  if (!project) throw Object.assign(new Error("That record wasn't found."), { status: 404 });
  const facts = (input.facts ?? []).slice(0, 6).map((f) => ({ label: String(f.label).slice(0, 40), value: String(f.value).slice(0, 80) }));
  const opening = String(input.opening ?? "").slice(0, 1500);
  const completed = (input.completed ?? []).map((c) => String(c).slice(0, 160)).filter(Boolean).slice(0, 10);
  const comingSoon = (input.coming_soon ?? []).filter((c) => c?.item).slice(0, 8)
    .map((c) => ({ item: String(c.item).slice(0, 160), when: c.when ? String(c.when).slice(0, 40) : null }));
  // Photos must be our own stored images (public Supabase storage), never an arbitrary URL.
  const storage = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const photos = (input.photos ?? []).filter((p) => typeof p?.url === "string" && storage && p.url.startsWith(`${storage}/storage/v1/object/public/`))
    .slice(0, 8).map((p) => ({ url: p.url, caption: p.caption ? String(p.caption).slice(0, 80) : null }));

  const channel: SummaryChannel = input.channel === "sms" ? "sms" : "email";
  // A team summary holds internal detail; it is never put behind a shareable link.
  if (channel === "sms" && input.audience !== "client") {
    throw Object.assign(new Error("Only client summaries can be sent by text."), { status: 400 });
  }
  const { staff, contacts } = await loadRecipients(input.target, input.id);
  // `address` is an email for email sends and an E.164 number for texts.
  const to: { name: string; firstName: string | null; address: string; contactId: string | null; kind: "staff" | "client" | "other" }[] = [];
  if (channel === "email") {
    for (const sid of input.staff_ids ?? []) {
      const s = staff.find((x) => x.id === sid);
      if (s?.email) to.push({ name: s.name, firstName: s.firstName, address: s.email, contactId: null, kind: "staff" });
    }
  }
  if (input.audience === "client") {
    for (const cid of input.contact_ids ?? []) {
      const c = contacts.find((x) => x.id === cid);
      const address = channel === "email" ? c?.email : toE164(c?.phone);
      if (c && address) to.push({ name: c.name, firstName: c.firstName, address, contactId: c.id, kind: "client" });
    }
    if (channel === "email") {
      for (const raw of input.extra_emails ?? []) {
        const e = raw.trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) to.push({ name: e, firstName: null, address: e, contactId: null, kind: "other" });
      }
    } else {
      for (const raw of input.extra_phones ?? []) {
        const n = toE164(raw);
        if (n) to.push({ name: raw.trim(), firstName: null, address: n, contactId: null, kind: "other" });
      }
    }
  }
  const unique = [...new Map(to.map((t) => [t.address.toLowerCase(), t])).values()];
  if (!unique.length && !input.post_to_portal) throw Object.assign(new Error("Choose at least one recipient."), { status: 400 });

  // Save first so a text can link to this exact summary.
  const { data: saved, error: saveErr } = await getSupabaseAdmin().from("executive_summaries").insert({
    job_id: input.target === "job" ? input.id : null,
    opportunity_id: input.target === "precon" ? input.id : null,
    audience: input.audience, headline, body_html: body, facts,
    content: { opening, completed, coming_soon: comingSoon, photos, channel },
    status: "sent", sent_to: [], posted_to_portal: false,
    created_by: actor.id, created_by_name: actor.name, sent_at: new Date().toISOString(),
  }).select("id").single();
  if (saveErr || !saved) throw new Error(saveErr?.message ?? "Couldn't save the summary.");
  const summaryId = saved.id as string;

  const app = publicAppUrl();
  const href = input.target === "job" ? `/dashboard/jobs/${input.id}/summary` : `/dashboard/sales/${input.id}`;
  // One document per reader so the greeting uses their first name.
  const htmlFor = (firstName: string | null) => summaryDocumentHtml({
    audience: input.audience, kind: project.kind,
    projectName: project.name, projectNumber: project.number,
    headline, opening, firstName, facts, completed, comingSoon, photos, bodyHtml: body, preparedBy: actor.name,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }).format(new Date()),
    appUrl: app, note: input.note ?? null,
    cta: input.audience === "team"
      ? { label: `Open in the CMI Dashboard`, url: `${app}${href}` }
      : input.target === "job" ? { label: "View your project portal", url: `${app}/client/jobs/${input.id}/overview` } : null,
  });
  const subject = `${input.audience === "team" ? "[Internal] " : ""}${project.name} — Executive Summary`;

  const portalUrl = input.target === "job" ? `${app}/client/jobs/${input.id}/overview` : null;
  const smsFor = (firstName: string | null, reader: string) => [
    input.note?.trim() || null,
    `Hi ${(firstName ?? "").trim() || "there"}, here's the latest update on ${project.name} from Constructed Matter: ${headline}`,
    `View or save the summary as a PDF: ${summaryLink(summaryId, reader)}`,
    portalUrl ? `Your project portal: ${portalUrl}` : null,
    "Reply STOP to opt out.",
  ].filter(Boolean).join("\n\n");

  const sent: string[] = [];
  const delivered: (typeof unique[number] & { reader: string })[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const r of unique) {
    if (r.kind !== "staff" && (await isSuppressed(channel, r.address).catch(() => false))) {
      skipped.push({ name: r.name, reason: channel === "email" ? "unsubscribed from email" : "opted out of texts" });
      continue;
    }
    const reader = randomUUID().replace(/-/g, "").slice(0, 12);
    const content = channel === "email" ? htmlFor(r.firstName) : smsFor(r.firstName, reader);
    const ok = channel === "email"
      ? await sendEmail(r.address, subject, content).catch(() => false)
      : await sendSms(r.address, content).catch(() => false);
    if (!ok) { skipped.push({ name: r.name, reason: channel === "email" ? "email failed" : "text failed" }); continue; }
    sent.push(r.name);
    delivered.push({ ...r, reader });
    // Record it with the job's other messages (Communications page / counts).
    if (r.kind !== "staff") {
      await logMessage({
        direction: "outbound", channel, contact_id: r.contactId, to_address: r.address, from_address: null,
        subject: channel === "email" ? subject : null, body: content, status: "sent", project_id: null,
        ...(input.target === "job" ? { job_id: input.id } : {}),
        quote_id: null, provider: channel === "email" ? "resend" : "twilio", provider_id: null, error_message: null,
        duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  let posted = false;
  if (input.post_to_portal && input.audience === "client" && input.target === "job") {
    await createJobUpdate(input.id, {
      title: headline,
      body: [opening.replace(/\{\{\s*first_name\s*\}\}/gi, "there"), completed.length ? `Completed:\n${completed.map((c) => `• ${c}`).join("\n")}` : "", comingSoon.length ? `Coming soon:\n${comingSoon.map((c) => `• ${c.item}${c.when ? ` (${c.when})` : ""}`).join("\n")}` : "", htmlToText(body)].filter(Boolean).join("\n\n"),
      media: photos.map((p) => ({ url: p.url, type: "image" as const, name: p.caption ?? undefined })),
      update_type: "general",
      visibility: "client_visible",
    }, actor.name);
    posted = true;
  }

  await getSupabaseAdmin().from("executive_summaries").update({
    sent_to: delivered.map((u) => ({ name: u.name, firstName: u.firstName, reader: u.reader, [channel === "email" ? "email" : "phone"]: u.address, kind: u.kind })),
    posted_to_portal: posted,
  }).eq("id", summaryId);

  return { sent, skipped, posted, channel, link: input.audience === "client" ? summaryLink(summaryId) : null };
}

export async function loadHistory(target: SummaryTarget, id: string) {
  const { data } = await getSupabaseAdmin().from("executive_summaries")
    .select("id,audience,headline,body_html,facts,content,sent_to,posted_to_portal,created_by_name,sent_at,created_at")
    .eq(target === "job" ? "job_id" : "opportunity_id", id)
    .order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
