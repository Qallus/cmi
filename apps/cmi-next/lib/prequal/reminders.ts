// Trade partner document reminders (brief §8): first notice 45 days before a
// COI or license expires, weekly after that, urgent with the office CC'd in
// the last 7 days, and nothing more to the sub once it has expired. Expiry
// instead raises one internal alert so someone follows up by phone.
//
// The scheduled runner (lib/automations/runner.ts) calls scanTradePartnerDocuments
// to queue automation_events and renderTradePartnerReminder to send them.
// Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { notifyStaff } from "@/lib/notifications/dispatch";
import { reminderStage } from "./coverage";
import { documentUploadUrl } from "./documents";
import { PREQUAL_DECIDE_ROLES } from "./access";
import { TP_FOOTER } from "./msa";

export const TP_REMINDER_KIND = "tp_doc_reminder";

/** Partners we've stopped working with don't get chased. */
const SKIP_STATUSES = ["declined", "inactive", "suspended"];

type QueueFn = (event: {
  kind: string; dedupeKey: string; subjectType?: string; subjectId?: string;
  channel: string; recipient: string | null; payload: Record<string, unknown>;
}) => Promise<boolean>;

export type ReminderPayload = {
  company: string;
  company_id: string;
  document: string;
  expires_on: string;
  bucket: string;
  urgent: boolean;
  contact_name: string | null;
  cc: string | null;
  url: string | null;
};

export function daysUntil(date: string, today = new Date().toISOString().slice(0, 10)): number {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Who gets compliance email at a company: accounting, then primary, then anyone with an email. */
async function complianceContact(companyId: string): Promise<{ email: string; first_name: string | null } | null> {
  const { data } = await getSupabaseAdmin()
    .from("contacts").select("email, first_name, company_roles, last_activity")
    .eq("company_id", companyId).not("email", "is", null)
    .order("last_activity", { ascending: false, nullsFirst: false }).limit(20);
  const people = (data ?? []) as { email: string; first_name: string | null; company_roles: string[] | null }[];
  const pick = people.find((p) => p.company_roles?.includes("accounting"))
    ?? people.find((p) => p.company_roles?.includes("primary"))
    ?? people[0];
  return pick ? { email: pick.email, first_name: pick.first_name } : null;
}

/** The sub's own upload link: their most recent submitted application. */
async function uploadLinkFor(companyId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("prequal_applications").select("token")
    .eq("company_id", companyId).neq("status", "draft")
    .order("submitted_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  return data?.token ? documentUploadUrl({ token: data.token as string }) : null;
}

/**
 * Queue a reminder for each expiring document whose stage has a bucket not
 * yet sent; on expiry, mark it expired and alert the office once. A dry run
 * queues (so the pending list shows what would go) but changes nothing else.
 */
export async function scanTradePartnerDocuments(queue: QueueFn, opts: { dryRun?: boolean } = {}): Promise<number> {
  const supabase = getSupabaseAdmin();
  const horizon = new Date(Date.now() + 46 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("company_documents")
    .select("id, company_id, doc_type, label, expires_on, status, companies(name, qualification_status, archived_at)")
    .not("expires_on", "is", null)
    .lte("expires_on", horizon)
    .neq("status", "rejected")
    .neq("doc_type", "msa");

  const rows = (data ?? []) as unknown as {
    id: string; company_id: string; doc_type: string; label: string | null; expires_on: string; status: string;
    companies: { name: string; qualification_status: string | null; archived_at: string | null } | null;
  }[];

  const cc = process.env.TRADE_PARTNER_COMPLIANCE_CC?.trim() || null;
  let queued = 0;
  for (const doc of rows) {
    const company = doc.companies;
    if (!company || company.archived_at || SKIP_STATUSES.includes(company.qualification_status ?? "")) continue;
    const stage = reminderStage(daysUntil(doc.expires_on));
    if (!stage) continue;
    const document = doc.label || doc.doc_type.toUpperCase();

    if (stage.kind === "expired") {
      if (opts.dryRun) continue;
      if (doc.status !== "expired") await supabase.from("company_documents").update({ status: "expired" }).eq("id", doc.id);
      const { data: staff } = await supabase.from("staff_users").select("id")
        .in("role_slug", [...PREQUAL_DECIDE_ROLES]).in("status", ["active", "invited"]);
      await notifyStaff({
        recipientIds: (staff ?? []).map((s) => s.id as string),
        kind: "trade_partner_document_expired",
        title: `${company.name}: ${document} expired ${doc.expires_on}`,
        body: "Reminders have stopped. Follow up directly, and hold any new work until a current copy is on file.",
        url: "/dashboard/trade-partners?tab=compliance",
        sourceTable: "company_documents", sourceId: doc.id,
        dedupeKey: `tp_doc_expired:${doc.id}:${doc.expires_on}`,
      }).catch((err) => console.error("[reminders] expiry alert failed", err));
      continue;
    }

    const contact = await complianceContact(doc.company_id);
    const payload: ReminderPayload = {
      company: company.name, company_id: doc.company_id, document, expires_on: doc.expires_on,
      bucket: stage.bucket, urgent: stage.urgent, contact_name: contact?.first_name ?? null,
      cc: stage.urgent ? cc : null, url: await uploadLinkFor(doc.company_id),
    };
    if (await queue({
      kind: TP_REMINDER_KIND,
      dedupeKey: `${TP_REMINDER_KIND}:${doc.id}:${doc.expires_on}:${stage.bucket}`,
      subjectType: "company_document", subjectId: doc.id,
      channel: "email", recipient: contact?.email ?? null, payload,
    })) queued += 1;
  }
  return queued;
}

/**
 * Is a queued reminder still the right one to send? A replacement upload
 * changes the expiry, and a reminder queued during a dry run may be weeks old.
 */
export async function reminderStillDue(docId: string | null, p: ReminderPayload): Promise<boolean> {
  if (!docId) return false;
  const { data } = await getSupabaseAdmin().from("company_documents").select("expires_on, status").eq("id", docId).maybeSingle();
  if (!data || data.expires_on !== p.expires_on || data.status === "rejected") return false;
  const stage = reminderStage(daysUntil(p.expires_on));
  return stage?.kind === "notice" && stage.bucket === p.bucket;
}

export function renderTradePartnerReminder(p: ReminderPayload): { subject: string; html: string; text: string } {
  const days = daysUntil(p.expires_on);
  const when = new Date(`${p.expires_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const subject = p.urgent
    ? `Action needed: ${p.document} expires ${days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`
    : `${p.document} expires ${when}`;
  const paragraphs = [
    p.contact_name ? `Hi ${p.contact_name},` : "Hello,",
    `Our records show ${p.company}'s ${p.document} expires on ${when}.`,
    p.urgent
      ? "We can't schedule work or issue purchase orders once it lapses, so please send the renewed copy as soon as you have it."
      : "We keep a current copy on file for every trade partner. When it renews, upload the new one with the link below.",
    "If you've already renewed, upload it or reply to this email with it attached and we'll take care of the rest.",
  ];
  const html = notificationEmailHtml({
    audience: "external", footerNote: TP_FOOTER,
    eyebrow: p.urgent ? "Compliance · action needed" : "Compliance reminder",
    heading: subject, paragraphs,
    facts: [{ label: "Company", value: p.company }, { label: "Document", value: p.document }, { label: "Expires", value: when }],
    cta: p.url ? { label: "Upload the renewed copy", url: p.url } : null,
  });
  return { subject, html, text: paragraphs.join("\n\n") };
}
