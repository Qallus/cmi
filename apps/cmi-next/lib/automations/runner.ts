// The scheduled automation run.
//
// One entry point, called on a schedule by Coolify. It scans for things that
// have become due, records each as an automation_event with a unique dedupe
// key, then dispatches whatever is still pending. Running it twice in a row is
// harmless: the second run finds nothing new to create and nothing pending.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail, sendSms, shareEmailHtml, escapeHtml } from "@/lib/messaging/send";
import { isSuppressed } from "@/lib/messaging/consent";
import { publicAppUrl } from "@/lib/twilio";

/** Days before an expiry date that we speak up. */
export const EXPIRY_THRESHOLDS = [30, 7, 0] as const;

/**
 * A booking confirmation queued weeks ago is not worth sending now — the
 * appointment has already happened. Anything older than this is closed off as
 * skipped rather than delivered late.
 */
const STALE_NOTIFICATION_HOURS = 24;

/** Applications nobody has picked up after this long get chased internally. */
const AWAITING_REVIEW_DAYS = 3;

type Summary = {
  run_id: string;
  scanned: Record<string, number>;
  sent: number;
  skipped: number;
  failed: number;
  events: { kind: string; recipient: string | null; status: string; reason?: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export async function runAutomations(opts: { trigger?: string; dryRun?: boolean } = {}): Promise<Summary> {
  const supabase = getSupabaseAdmin();
  const { data: run } = await supabase
    .from("automation_runs")
    .insert({ trigger: opts.trigger ?? "manual" })
    .select("id")
    .single();
  const runId = (run as { id: string })?.id;

  const scanned: Record<string, number> = {};
  try {
    scanned.document_expiries = await scanDocumentExpiries();
    scanned.qualification_renewals = await scanQualificationRenewals();
    scanned.awaiting_review = await scanAwaitingReview();
    scanned.queued_bookings = await scanQueuedBookings();
  } catch (err) {
    await supabase.from("automation_runs")
      .update({ finished_at: new Date().toISOString(), error: (err as Error).message, scanned })
      .eq("id", runId);
    throw err;
  }

  const result = opts.dryRun
    ? { sent: 0, skipped: 0, failed: 0, events: [] as Summary["events"] }
    : await dispatchPending();

  await supabase.from("automation_runs").update({
    finished_at: new Date().toISOString(),
    scanned,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
  }).eq("id", runId);

  return { run_id: runId, scanned, ...result };
}

// ─── Scanners: turn "this is now due" into a pending event ─────────────────

/**
 * Insert an event unless its dedupe key already exists. The unique index is
 * what actually guarantees once-only, not this check.
 */
async function queue(event: {
  kind: string;
  dedupeKey: string;
  subjectType?: string;
  subjectId?: string | null;
  channel: string;
  recipient: string | null;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("automation_events").insert({
    kind: event.kind,
    dedupe_key: event.dedupeKey,
    subject_type: event.subjectType ?? null,
    subject_id: event.subjectId ?? null,
    channel: event.channel,
    recipient: event.recipient,
    payload: event.payload,
  });
  // 23505 = already queued on an earlier run, which is the normal case.
  if (error && error.code !== "23505") throw new Error(error.message);
  return !error;
}

/** Insurance certificates and licences approaching, or past, their expiry. */
async function scanDocumentExpiries(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("company_documents")
    .select("id, company_id, doc_type, label, expires_on, status, companies(name)")
    .not("expires_on", "is", null)
    .lte("expires_on", daysFromNow(Math.max(...EXPIRY_THRESHOLDS)))
    .neq("status", "rejected");

  const rows = (data ?? []) as unknown as {
    id: string; company_id: string; doc_type: string; label: string | null;
    expires_on: string; status: string; companies: { name: string } | null;
  }[];

  let queued = 0;
  for (const doc of rows) {
    const daysLeft = Math.floor(
      (new Date(`${doc.expires_on}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000,
    );
    // The tightest threshold this document has now crossed.
    const threshold = EXPIRY_THRESHOLDS.find((t) => daysLeft <= t);
    if (threshold === undefined) continue;

    const contact = await primaryContactFor(doc.company_id);
    if (await queue({
      kind: daysLeft < 0 ? "document_expired" : "document_expiring",
      dedupeKey: `doc_expiry_${threshold}:${doc.id}`,
      subjectType: "company_document",
      subjectId: doc.id,
      channel: "email",
      recipient: contact?.email ?? null,
      payload: {
        company: doc.companies?.name ?? "your company",
        company_id: doc.company_id,
        document: doc.label ?? doc.doc_type,
        expires_on: doc.expires_on,
        days_left: daysLeft,
        contact_name: contact?.first_name ?? null,
      },
    })) queued += 1;

    if (daysLeft < 0 && doc.status !== "expired") {
      await supabase.from("company_documents").update({ status: "expired" }).eq("id", doc.id);
    }
  }
  return queued;
}

/** Approved partners whose yearly qualification is running out. */
async function scanQualificationRenewals(): Promise<number> {
  const { data } = await getSupabaseAdmin()
    .from("companies")
    .select("id, name, qualification_expires_at")
    .in("qualification_status", ["approved", "preferred"])
    .not("qualification_expires_at", "is", null)
    .lte("qualification_expires_at", daysFromNow(30))
    .is("archived_at", null);

  let queued = 0;
  for (const c of (data ?? []) as { id: string; name: string; qualification_expires_at: string }[]) {
    const contact = await primaryContactFor(c.id);
    if (await queue({
      kind: "qualification_renewal_due",
      dedupeKey: `renewal:${c.id}:${c.qualification_expires_at}`,
      subjectType: "company",
      subjectId: c.id,
      channel: "email",
      recipient: contact?.email ?? null,
      payload: { company: c.name, expires_on: c.qualification_expires_at, contact_name: contact?.first_name ?? null },
    })) queued += 1;
  }
  return queued;
}

/** Applications sitting unreviewed — chased internally, not to the applicant. */
async function scanAwaitingReview(): Promise<number> {
  const cutoff = new Date(Date.now() - AWAITING_REVIEW_DAYS * 86_400_000).toISOString();
  const { data } = await getSupabaseAdmin()
    .from("prequal_applications")
    .select("id, company_name, submitted_at")
    .eq("status", "submitted")
    .is("reviewer_id", null)
    .lte("submitted_at", cutoff);

  let queued = 0;
  for (const app of (data ?? []) as { id: string; company_name: string | null; submitted_at: string }[]) {
    if (await queue({
      kind: "application_awaiting_review",
      dedupeKey: `awaiting_review:${app.id}:${app.submitted_at.slice(0, 10)}`,
      subjectType: "prequal_application",
      subjectId: app.id,
      channel: "email",
      recipient: process.env.AUTOMATION_STAFF_EMAIL ?? "info@constructedmatter.com",
      payload: { company: app.company_name ?? "An applicant", submitted_at: app.submitted_at, application_id: app.id },
    })) queued += 1;
  }
  return queued;
}

/**
 * The booking queue nothing has ever drained. Recent rows are promoted to
 * pending automation events; anything stale is closed off, because a
 * confirmation for last month's appointment helps nobody.
 */
async function scanQueuedBookings(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("booking_notifications")
    .select("id, notification_type, channel, recipient_email, recipient_phone, subject, body, created_at")
    .eq("status", "queued")
    .limit(200);

  const rows = (data ?? []) as {
    id: string; notification_type: string; channel: string;
    recipient_email: string | null; recipient_phone: string | null;
    subject: string | null; body: string | null; created_at: string;
  }[];

  const staleBefore = Date.now() - STALE_NOTIFICATION_HOURS * 3_600_000;
  let queued = 0;

  for (const row of rows) {
    // "dashboard" notifications have no outbound channel to send on.
    if (row.channel !== "email" && row.channel !== "sms") {
      await supabase.from("booking_notifications").update({ status: "skipped" }).eq("id", row.id);
      continue;
    }
    if (new Date(row.created_at).getTime() < staleBefore) {
      await supabase.from("booking_notifications").update({ status: "skipped" }).eq("id", row.id);
      continue;
    }

    const recipient = row.channel === "email" ? row.recipient_email : row.recipient_phone;
    if (!recipient) {
      await supabase.from("booking_notifications").update({ status: "skipped" }).eq("id", row.id);
      continue;
    }

    if (await queue({
      kind: `booking_${row.notification_type}`,
      dedupeKey: `booking_notification:${row.id}`,
      subjectType: "booking_notification",
      subjectId: row.id,
      channel: row.channel,
      recipient,
      payload: { subject: row.subject, body: row.body },
    })) queued += 1;

    await supabase.from("booking_notifications").update({ status: "sending" }).eq("id", row.id);
  }
  return queued;
}

async function primaryContactFor(companyId: string): Promise<{ email: string; first_name: string } | null> {
  const { data } = await getSupabaseAdmin()
    .from("contacts")
    .select("email, first_name")
    .eq("company_id", companyId)
    .order("last_activity", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as { email: string; first_name: string }) ?? null;
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

async function dispatchPending() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("automation_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(100);

  const events = (data ?? []) as {
    id: string; kind: string; channel: string; recipient: string | null;
    payload: Record<string, unknown>; subject_id: string | null;
  }[];

  let sent = 0, skipped = 0, failed = 0;
  const log: Summary["events"] = [];

  for (const event of events) {
    const close = async (status: string, extra: Record<string, unknown> = {}) => {
      await supabase.from("automation_events")
        .update({ status, sent_at: status === "sent" ? new Date().toISOString() : null, ...extra })
        .eq("id", event.id);
    };

    if (!event.recipient) {
      await close("skipped", { skip_reason: "no recipient on file" });
      skipped += 1;
      log.push({ kind: event.kind, recipient: null, status: "skipped", reason: "no recipient on file" });
      continue;
    }

    // Opting out beats any automation.
    if (await isSuppressed(event.channel === "sms" ? "sms" : "email", event.recipient)) {
      await close("skipped", { skip_reason: "recipient opted out" });
      skipped += 1;
      log.push({ kind: event.kind, recipient: event.recipient, status: "skipped", reason: "opted out" });
      continue;
    }

    try {
      const ok = event.channel === "sms"
        ? await sendSms(event.recipient, smsBody(event.kind, event.payload))
        : await sendEmail(event.recipient, emailSubject(event.kind, event.payload), emailBody(event.kind, event.payload));

      if (ok) {
        await close("sent");
        sent += 1;
        log.push({ kind: event.kind, recipient: event.recipient, status: "sent" });
        if (event.kind.startsWith("booking_") && event.subject_id) {
          await supabase.from("booking_notifications")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", event.subject_id);
        }
      } else {
        await close("failed", { error: "provider not configured or rejected the message" });
        failed += 1;
        log.push({ kind: event.kind, recipient: event.recipient, status: "failed" });
      }
    } catch (err) {
      await close("failed", { error: (err as Error).message });
      failed += 1;
      log.push({ kind: event.kind, recipient: event.recipient, status: "failed", reason: (err as Error).message });
    }
  }

  return { sent, skipped, failed, events: log };
}

// ─── Message bodies ────────────────────────────────────────────────────────

function emailSubject(kind: string, p: Record<string, unknown>): string {
  switch (kind) {
    case "document_expiring": return `${p.document} expires ${p.expires_on} — Constructed Matter`;
    case "document_expired": return `${p.document} has expired — Constructed Matter`;
    case "qualification_renewal_due": return "Your trade partner qualification is due for renewal";
    case "application_awaiting_review": return `Prequalification awaiting review: ${p.company}`;
    default: return String(p.subject ?? "Constructed Matter, Inc.");
  }
}

function emailBody(kind: string, p: Record<string, unknown>): string {
  const name = p.contact_name ? `Hi ${escapeHtml(String(p.contact_name))},` : "Hello,";

  if (kind === "document_expiring" || kind === "document_expired") {
    const expired = kind === "document_expired";
    return shareEmailHtml({
      intro: name,
      lines: [
        expired
          ? `${p.document} for ${p.company} expired on ${p.expires_on}.`
          : `${p.document} for ${p.company} expires on ${p.expires_on}.`,
        "We keep current certificates on file for every trade partner, so please send the renewed copy when you have it.",
        "If you've already renewed, just reply with the new certificate attached.",
      ],
      note: null,
      url: `${publicAppUrl()}/prequalification`,
      cta: "Send an updated certificate",
      footer: "Constructed Matter, Inc. · (480) 628-4458 · info@constructedmatter.com",
    });
  }

  if (kind === "qualification_renewal_due") {
    return shareEmailHtml({
      intro: name,
      lines: [
        `${p.company}'s trade partner qualification with Constructed Matter is due for renewal on ${p.expires_on}.`,
        "Renewing keeps you on our bid lists. It's a short form — most of it is already filled in from last time.",
      ],
      note: null,
      url: `${publicAppUrl()}/prequalification`,
      cta: "Renew your qualification",
      footer: "Constructed Matter, Inc. · (480) 628-4458 · info@constructedmatter.com",
    });
  }

  if (kind === "application_awaiting_review") {
    return shareEmailHtml({
      intro: "A prequalification application hasn't been picked up.",
      lines: [
        `${p.company} applied on ${String(p.submitted_at).slice(0, 10)} and still has no reviewer assigned.`,
      ],
      note: null,
      url: `${publicAppUrl()}/dashboard/trade-partners`,
      cta: "Open Trade Partners",
      footer: "Internal — Constructed Matter, Inc.",
    });
  }

  // Booking notifications carry their own body text.
  return shareEmailHtml({
    intro: "Constructed Matter, Inc.",
    lines: [String(p.body ?? p.subject ?? "")],
    note: null,
    url: `${publicAppUrl()}/book`,
    cta: "View your appointment",
    footer: "Constructed Matter, Inc. · (480) 628-4458",
  });
}

function smsBody(kind: string, p: Record<string, unknown>): string {
  if (kind === "document_expiring" || kind === "document_expired") {
    return `Constructed Matter, Inc.: ${p.document} for ${p.company} ${kind === "document_expired" ? "has expired" : `expires ${p.expires_on}`}. Please send an updated certificate. Reply STOP to unsubscribe.`;
  }
  return `Constructed Matter, Inc.: ${String(p.body ?? p.subject ?? "")}`.slice(0, 600);
}
