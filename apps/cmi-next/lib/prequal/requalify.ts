// Requalification (trade partner brief §8): the office picks partners, adds an
// optional message, and each one gets a link to a copy of their last
// application, already filled in. Documents still current carry over;
// anything expired or expiring is left blank to upload again. The MSA is
// re-signed only when the office asks or the partner never signed the current
// version. Submitting lands in the normal review queue; approval keeps them
// approved and resets the year. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { logMessage } from "@/lib/communications/data";
import { FORM_VERSION, type Answers } from "./form";
import { newToken, PrequalError, type Application } from "./data";
import { outstandingDocuments } from "./documents";
import { sendApplicantEmail } from "./mail";
import { TP_FOOTER } from "./msa";
import { publicAppUrl } from "@/lib/twilio";
import type { CompanyDocument } from "./review";

export const REQUAL_SOURCE = "requalification";

export function requalUrl(token: string): string {
  return `${publicAppUrl()}/prequalification?t=${token}`;
}

/** Answers that belong to one sitting and are never carried into the next. */
const PER_SITTING = new Set(["msa_signature", "attestation", "attestation_name", "attestation_title", "attestation_agree"]);

/** The previous answers, minus signatures and any document that needs replacing. */
export function carryForward(previous: Answers, owedDocTypes: Set<string>): Answers {
  const out: Answers = {};
  for (const [key, value] of Object.entries(previous ?? {})) {
    if (PER_SITTING.has(key)) continue;
    if (key.startsWith("doc_") && owedDocTypes.has(key.slice(4))) continue;
    out[key] = value;
  }
  return out;
}

export type RequalResult = {
  sent: { company_id: string; company: string; email: string; held: boolean }[];
  skipped: { company_id: string; company: string; reason: string }[];
};

/**
 * Open (or reuse) a requalification draft for each company and email the link.
 * Partners marked requal_excluded are skipped unless named explicitly with
 * `force` — "select all" should never reach a sub we no longer use.
 */
export async function startRequalification(
  companyIds: string[],
  opts: { message?: string | null; includeMsa?: boolean; actorId: string; force?: boolean },
): Promise<RequalResult> {
  const supabase = getSupabaseAdmin();
  const ids = [...new Set(companyIds)].slice(0, 500);
  if (ids.length === 0) throw new PrequalError("Pick at least one trade partner.");
  const message = opts.message?.trim() || null;

  const { data: companies } = await supabase.from("companies")
    .select("id, name, qualification_status, requal_excluded, archived_at").in("id", ids);
  const result: RequalResult = { sent: [], skipped: [] };

  for (const c of (companies ?? []) as { id: string; name: string; qualification_status: string | null; requal_excluded: boolean; archived_at: string | null }[]) {
    const skip = (reason: string) => result.skipped.push({ company_id: c.id, company: c.name, reason });
    if (c.archived_at) { skip("archived"); continue; }
    if (c.requal_excluded && !opts.force) { skip("excluded from requalification"); continue; }

    const [{ data: lastApp }, { data: docs }, { data: openDraft }] = await Promise.all([
      supabase.from("prequal_applications").select("*").eq("company_id", c.id).neq("status", "draft")
        .order("submitted_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from("company_documents").select("*").eq("company_id", c.id),
      supabase.from("prequal_applications").select("*").eq("company_id", c.id).eq("source", REQUAL_SOURCE)
        .eq("status", "draft").is("archived_at", null).limit(1).maybeSingle(),
    ]);
    const prev = lastApp as Application | null;
    const email = (openDraft as Application | null)?.contact_email || prev?.contact_email
      || (await supabase.from("contacts").select("email").eq("company_id", c.id).not("email", "is", null)
        .order("last_activity", { ascending: false, nullsFirst: false }).limit(1).maybeSingle()).data?.email;
    if (!email) { skip("no contact email on file"); continue; }

    let app = openDraft as Application | null;
    if (app) {
      // Re-sending: refresh the message and MSA choice, keep their progress.
      const { data } = await supabase.from("prequal_applications").update({
        requal_message: message, requal_include_msa: !!opts.includeMsa, requested_by: opts.actorId,
        updated_at: new Date().toISOString(),
      }).eq("id", app.id).select().single();
      app = (data as Application) ?? app;
    } else {
      const owed = new Set(outstandingDocuments((docs ?? []) as CompanyDocument[]).map((d) => d.doc_type));
      const answers = carryForward(prev?.answers ?? {}, owed);
      const { data, error } = await supabase.from("prequal_applications").insert({
        token: newToken(), form_version: FORM_VERSION, source: REQUAL_SOURCE,
        company_id: c.id, contact_id: prev?.contact_id ?? null,
        answers, company_name: prev?.company_name ?? c.name, partner_type: prev?.partner_type ?? null,
        contact_first_name: prev?.contact_first_name ?? null, contact_last_name: prev?.contact_last_name ?? null,
        contact_email: email, contact_phone: prev?.contact_phone ?? null, contact_title: prev?.contact_title ?? null,
        requal_message: message, requal_include_msa: !!opts.includeMsa, requested_by: opts.actorId,
      }).select().single();
      if (error || !data) { skip(error?.message ?? "couldn't create the form"); continue; }
      app = data as Application;
    }

    const subject = "Time to update your trade partner profile with Constructed Matter";
    const paragraphs = [
      app.contact_first_name ? `Hi ${app.contact_first_name},` : "Hello,",
      `We're updating our records for every trade partner. Please take a few minutes to confirm ${c.name}'s details. Your last answers are already filled in, so you only need to change what's different.`,
      ...(message ? [message] : []),
      "Please upload any certificate or license that has expired or is about to"
        + (opts.includeMsa ? ", and sign our current Master Subcontractor Agreement on the last step." : "."),
    ];
    const html = notificationEmailHtml({
      audience: "external", footerNote: TP_FOOTER, eyebrow: "Trade partner requalification",
      heading: "Please update your trade partner profile", paragraphs,
      cta: { label: "Review and update", url: requalUrl(app.token) },
    });
    const sent = await sendApplicantEmail({ to: email, subject, html });
    if (!sent.sent && !sent.held) { skip(sent.error ?? "email failed"); continue; }

    await supabase.from("companies").update({ requal_requested_at: new Date().toISOString() }).eq("id", c.id);
    try {
      await logMessage({
        direction: "outbound", channel: "email", contact_id: app.contact_id, to_address: email,
        from_address: "info@constructedmatter.com", subject, body: paragraphs.join("\n\n"),
        status: sent.sent ? "sent" : "queued", project_id: null, quote_id: null,
        provider: "resend", provider_id: null, error_message: sent.held ? "Held: not production" : null,
        duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[requalify] logging the email failed", err);
    }
    result.sent.push({ company_id: c.id, company: c.name, email, held: !!sent.held });
  }

  for (const id of ids) {
    if (!result.sent.some((s) => s.company_id === id) && !result.skipped.some((s) => s.company_id === id)) {
      result.skipped.push({ company_id: id, company: id, reason: "not found" });
    }
  }
  return result;
}

/** Does this company already have a signature on the given MSA version? */
export async function companySignedVersion(companyId: string | null, msaVersionId: string): Promise<boolean> {
  if (!companyId) return false;
  const { count } = await getSupabaseAdmin().from("msa_signatures").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("msa_version_id", msaVersionId).not("signed_at", "is", null);
  return (count ?? 0) > 0;
}

/** Is signing the MSA part of submitting this application? */
export async function msaRequiredFor(app: Pick<Application, "company_id"> & { source?: string | null; requal_include_msa?: boolean | null }, msaVersionId: string): Promise<boolean> {
  if (app.source !== REQUAL_SOURCE) return true;
  if (app.requal_include_msa) return true;
  return !(await companySignedVersion(app.company_id, msaVersionId));
}
