// The four review-queue actions (trade partner brief §6): Approve as Trade
// Partner (onboarding email), Decline (reason required → Archive), and the two
// drafts (Schedule Follow-Up Meeting, Follow Up for missing documents), which
// the reviewer edits before sending. Server-only.
//
// Applicant emails go from info@ with reply-to set to the reviewer, so the
// conversation lands with whoever is handling it, and every send is logged in
// Communications against the contact.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { logMessage } from "@/lib/communications/data";
import { approvalParagraphs, draftParagraphs, followUpMeetingDraft, missingDocumentsDraft, type Draft } from "./drafts";
import { documentUploadUrl, onboardingGuide, outstandingDocuments } from "./documents";
import { sendApplicantEmail } from "./mail";
import { TP_FOOTER } from "./msa";
import { PrequalError, type Application } from "./data";
import { setApplicationArchived, setApplicationStatus, type CompanyDocument } from "./review";

type Reviewer = { id: string; name: string; title: string | null; email: string | null };

async function reviewer(staffId: string): Promise<Reviewer> {
  const { data } = await getSupabaseAdmin().from("staff_users").select("id, display_name, first_name, last_name, title, email").eq("id", staffId).maybeSingle();
  const name = data?.display_name || [data?.first_name, data?.last_name].filter(Boolean).join(" ") || "Constructed Matter";
  return { id: staffId, name, title: (data?.title as string | null) ?? null, email: (data?.email as string | null) ?? null };
}

/** Replies go to the reviewer when they have a company mailbox, otherwise info@. */
function replyToFor(r: Reviewer): string {
  const domain = (process.env.GOOGLE_WORKSPACE_DOMAIN || "constructedmatter.com").toLowerCase();
  return r.email && r.email.toLowerCase().endsWith(`@${domain}`) ? r.email : "info@constructedmatter.com";
}

async function load(id: string): Promise<{ app: Application; docs: CompanyDocument[] }> {
  const supabase = getSupabaseAdmin();
  const { data: app } = await supabase.from("prequal_applications").select("*").eq("id", id).maybeSingle();
  if (!app) throw new PrequalError("Application not found.", 404);
  const { data: docs } = app.company_id
    ? await supabase.from("company_documents").select("*").eq("company_id", app.company_id)
    : { data: [] };
  return { app: app as Application, docs: (docs ?? []) as CompanyDocument[] };
}

const docName = (d: CompanyDocument) => d.label || d.doc_type.toUpperCase();

/** Drafts the drawer opens, already filled in for this applicant and reviewer. */
export async function buildDrafts(id: string, staffId: string): Promise<{ meeting: Draft; missing: Draft; missingList: string[]; uploadUrl: string; to: string | null; replyTo: string }> {
  const [{ app, docs }, r] = await Promise.all([load(id), reviewer(staffId)]);
  const base = { firstName: app.contact_first_name, company: app.company_name, reviewerName: r.name, reviewerTitle: r.title };
  const missingList = outstandingDocuments(docs).map(docName);
  const uploadUrl = documentUploadUrl(app);
  return {
    meeting: followUpMeetingDraft(base),
    missing: missingDocumentsDraft({ ...base, missing: missingList, uploadUrl }),
    missingList, uploadUrl, to: app.contact_email, replyTo: replyToFor(r),
  };
}

async function send(app: Application, r: Reviewer, subject: string, paragraphs: string[], attachments?: { filename: string; content: Uint8Array }[], eyebrow = "Trade partner application") {
  if (!app.contact_email) throw new PrequalError("This application has no contact email.");
  const html = notificationEmailHtml({ audience: "external", footerNote: TP_FOOTER, eyebrow, heading: subject, paragraphs });
  const result = await sendApplicantEmail({ to: app.contact_email, subject, html, replyTo: replyToFor(r), attachments });
  if (!result.sent && !result.held) throw new PrequalError(`Couldn't send the email: ${result.error ?? "unknown error"}`, 502);
  try {
    await logMessage({
      direction: "outbound", channel: "email", contact_id: app.contact_id, to_address: app.contact_email,
      from_address: "info@constructedmatter.com", subject, body: paragraphs.join("\n\n"),
      status: result.sent ? "sent" : "queued", project_id: null, quote_id: null,
      provider: "resend", provider_id: null, error_message: result.held ? "Held: not production" : null,
      duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[prequal] logging the email failed", err);
  }
  return result;
}

/** Send an edited draft; moves the application along to match. */
export async function sendDraft(id: string, staffId: string, input: { kind: "meeting" | "missing"; subject: string; body: string }) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new PrequalError("Add a subject and a message.");
  if (/\[DAY, DATE at TIME\]/.test(body)) throw new PrequalError("Fill in the meeting time before sending.");
  const [{ app }, r] = await Promise.all([load(id), reviewer(staffId)]);
  const result = await send(app, r, subject, draftParagraphs(body));
  await setApplicationStatus(id, input.kind === "meeting" ? "interview" : "info_requested", { actorId: staffId });
  return { sent: result.sent, held: !!result.held };
}

/** Approve as Trade Partner: status, company, and the onboarding email. */
export async function approve(id: string, staffId: string, note: string | null) {
  await setApplicationStatus(id, "approved", { reason: note, actorId: staffId });
  const [{ app, docs }, r, guide] = await Promise.all([load(id), reviewer(staffId), onboardingGuide()]);
  // After approval the W-9 and COI are mandatory — anything not in is a red flag.
  const outstanding = outstandingDocuments(docs).filter((d) => ["w9", "coi", "license", "msa"].includes(d.doc_type)).map(docName);
  let emailed = { sent: false, held: false };

  // A requalification: they're already a partner, so confirm rather than welcome.
  if (app.source === "requalification") {
    await getSupabaseAdmin().from("companies").update({ last_requalified_at: new Date().toISOString() }).eq("id", app.company_id);
    if (app.contact_email) {
      const paragraphs = [
        `${app.contact_first_name ? `Hi ${app.contact_first_name},` : "Hello,"} thank you for updating ${app.company_name ?? "your company"}'s profile. Your trade partner qualification with Constructed Matter is renewed for another year.`,
        ...(outstanding.length ? [`We still need: ${outstanding.join(", ")}. Upload them at ${documentUploadUrl(app)} or reply to this email with them attached.`] : []),
        "Keep your insurance and W-9 current through the same link. We'll remind you before anything expires.",
      ];
      const result = await send(app, r, "Your trade partner qualification is renewed", paragraphs, undefined, "Requalification complete");
      emailed = { sent: result.sent, held: !!result.held };
    }
    return { emailed, outstanding, guideAttached: false };
  }

  const pdf = guide.url ? await guide.bytes() : null;
  if (app.contact_email) {
    const result = await send(app, r, "Welcome to Constructed Matter's trade partner network", approvalParagraphs({
      firstName: app.contact_first_name, company: app.company_name, outstanding, hasGuide: !!pdf, uploadUrl: documentUploadUrl(app),
    }), pdf ? [{ filename: "Constructed Matter Trade Partner Onboarding Guide.pdf", content: pdf }] : undefined, "Trade partner approved");
    emailed = { sent: result.sent, held: !!result.held };
  }
  return { emailed, outstanding, guideAttached: !!pdf };
}

/** Decline: a reason is required, and the application goes to Archive (not deleted). */
export async function decline(id: string, staffId: string, reason: string) {
  if (!reason.trim()) throw new PrequalError("Add a reason for declining. It's kept with the application.");
  await setApplicationStatus(id, "declined", { reason: reason.trim(), actorId: staffId });
  await setApplicationArchived(id, true, staffId);
  return { archived: true };
}
