// Master Subcontractor Agreement: versions, in-application e-signature, and
// countersignature. Server-only (service role).
//
// Evidence model (UETA / ESIGN): consent text + timestamp, an emailed one-time
// code proving control of the signer's address, typed name/title and a drawn
// signature, IP and device, and the SHA-256 of the exact PDF presented. The
// executed PDF (MSA + certificate page) is the record, filed as a
// company_documents row ('msa') and emailed to the signer and info@.
import { createHash, randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { buildSignedMsaPdf, ESIGN_CONSENT_TEXT, sha256Hex } from "./msa-pdf";
import { sendApplicantEmail } from "./mail";
import { getByToken, PrequalError, type Application } from "./data";

const BUCKET = "prequal-documents";
const CODE_TTL_MS = 15 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
export const TP_FOOTER = "You're receiving this because of your trade partner application with Constructed Matter.";

export type MsaVersion = {
  id: string; label: string; storage_path: string; file_name: string | null; sha256: string;
  effective_at: string | null; is_current: boolean; created_at: string;
};

export type MsaSignature = {
  id: string; application_id: string | null; company_id: string | null; msa_version_id: string;
  signer_name: string; signer_title: string | null; signer_email: string;
  email_verified_at: string | null; signed_at: string | null; signed_pdf_path: string | null;
  countersigner_name: string | null; countersigned_at: string | null; created_at: string;
};

/** "Rev 2026" → "Rev2026" for file names. */
const fileLabel = (label: string | null | undefined) => (label ?? "").replace(/[^A-Za-z0-9]+/g, "") || "MSA";
const hashCode = (code: string, salt: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");

export async function getCurrentMsa(): Promise<MsaVersion | null> {
  const { data } = await getSupabaseAdmin().from("msa_versions").select("*").eq("is_current", true).maybeSingle();
  return (data as MsaVersion | null) ?? null;
}

export async function listMsaVersions(): Promise<MsaVersion[]> {
  const { data } = await getSupabaseAdmin().from("msa_versions").select("*").order("created_at", { ascending: false });
  return (data ?? []) as MsaVersion[];
}

export async function signedUrl(path: string, seconds = 300, downloadName?: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? null;
}

async function download(path: string): Promise<Uint8Array> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) throw new PrequalError("Couldn't read the agreement file.", 500);
  return new Uint8Array(await data.arrayBuffer());
}

async function upload(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new PrequalError(error.message, 500);
}

/** Admin: upload a new MSA PDF; optionally make it the one every new signer sees. */
export async function addMsaVersion(input: {
  bytes: Uint8Array; fileName: string; label: string; effectiveAt?: string | null; makeCurrent: boolean; staffId: string;
}): Promise<MsaVersion> {
  if (input.bytes.slice(0, 5).toString() !== [37, 80, 68, 70, 45].toString()) throw new PrequalError("Upload the MSA as a PDF.");
  const sha256 = sha256Hex(input.bytes);
  const path = `msa/${Date.now()}-${input.fileName.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
  await upload(path, input.bytes, "application/pdf");

  const supabase = getSupabaseAdmin();
  if (input.makeCurrent) await supabase.from("msa_versions").update({ is_current: false }).eq("is_current", true);
  const { data, error } = await supabase.from("msa_versions").insert({
    label: input.label.trim() || "MSA", storage_path: path, file_name: input.fileName, sha256,
    effective_at: input.effectiveAt || null, is_current: input.makeCurrent, uploaded_by: input.staffId,
  }).select().single();
  if (error) throw new PrequalError(error.message, 500);
  return data as MsaVersion;
}

export async function setCurrentMsa(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("msa_versions").update({ is_current: false }).eq("is_current", true);
  const { error } = await supabase.from("msa_versions").update({ is_current: true }).eq("id", id);
  if (error) throw new PrequalError(error.message, 500);
}

async function draftFor(token: string): Promise<Application> {
  const app = await getByToken(token);
  if (!app) throw new PrequalError("That application link is no longer valid.", 404);
  if (app.status !== "draft") throw new PrequalError("This application has already been submitted.", 409);
  return app;
}

/** The applicant's signature for this application, if they've signed. */
export async function signatureForApplication(applicationId: string): Promise<MsaSignature | null> {
  const { data } = await getSupabaseAdmin().from("msa_signatures").select("*")
    .eq("application_id", applicationId).not("signed_at", "is", null)
    .order("signed_at", { ascending: false }).limit(1).maybeSingle();
  return (data as MsaSignature | null) ?? null;
}

/** What the public step needs to render: the current MSA link and any signature. */
export async function msaStateForToken(token: string) {
  const app = await getByToken(token);
  if (!app) throw new PrequalError("That application link is no longer valid.", 404);
  const msa = await getCurrentMsa();
  const signature = await signatureForApplication(app.id);
  return {
    msa: msa ? { id: msa.id, label: msa.label, url: await signedUrl(msa.storage_path, 1800) } : null,
    signature: signature ? { signer_name: signature.signer_name, signer_title: signature.signer_title, signed_at: signature.signed_at, version_matches: signature.msa_version_id === msa?.id } : null,
    consent_text: ESIGN_CONSENT_TEXT,
  };
}

/** Step 1: email a 6-digit code to the signer. */
export async function sendSigningCode(token: string, signer: { name: string; title?: string | null; email: string }): Promise<{ held: boolean }> {
  const app = await draftFor(token);
  const msa = await getCurrentMsa();
  if (!msa) throw new PrequalError("The agreement isn't available yet. You can submit without it and we'll send it to you.", 409);
  const email = signer.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PrequalError("Enter a valid email address.");
  if (!signer.name.trim()) throw new PrequalError("Enter your full name.");

  const supabase = getSupabaseAdmin();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase.from("msa_signatures").select("id", { count: "exact", head: true })
    .eq("application_id", app.id).gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_CODES_PER_HOUR) throw new PrequalError("Too many codes requested. Try again in an hour.", 429);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: row, error } = await supabase.from("msa_signatures").insert({
    application_id: app.id, msa_version_id: msa.id,
    signer_name: signer.name.trim(), signer_title: signer.title?.trim() || null, signer_email: email,
    code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  }).select("id").single();
  if (error || !row) throw new PrequalError(error?.message ?? "Couldn't start signing.", 500);
  await supabase.from("msa_signatures").update({ code_hash: hashCode(code, row.id) }).eq("id", row.id);

  const html = notificationEmailHtml({
    audience: "external", footerNote: TP_FOOTER,
    eyebrow: "Trade partner application",
    heading: `Your signing code: ${code}`,
    paragraphs: [
      `Enter this code in your Constructed Matter application to sign the ${msa.label}. It expires in 15 minutes.`,
      "If you didn't request it, you can ignore this email.",
    ],
  });
  const sent = await sendApplicantEmail({ to: email, subject: `${code} is your Constructed Matter signing code`, html });
  if (sent.held) console.info(`[prequal] DEV signing code for ${email}: ${code}`);
  else if (!sent.sent) throw new PrequalError(`Couldn't email the code: ${sent.error ?? "unknown error"}`, 502);
  return { held: !!sent.held };
}

/** Step 2: verify the code, record consent and signature, build the executed PDF. */
export async function completeSignature(token: string, input: {
  code: string; consent: boolean; signaturePngBase64: string | null; ip: string | null; userAgent: string | null;
}): Promise<{ signed_at: string }> {
  const app = await draftFor(token);
  if (!input.consent) throw new PrequalError("Tick the box to agree to sign electronically.");
  const png = input.signaturePngBase64 ? Uint8Array.from(Buffer.from(input.signaturePngBase64.replace(/^data:image\/png;base64,/, ""), "base64")) : null;
  if (!png || png.length < 100) throw new PrequalError("Draw your signature in the box.");
  if (png.length > 500_000) throw new PrequalError("That signature image is too large. Clear it and sign again.");

  const supabase = getSupabaseAdmin();
  const { data: pending } = await supabase.from("msa_signatures").select("*")
    .eq("application_id", app.id).is("signed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!pending) throw new PrequalError("Request a signing code first.");
  if ((pending.code_attempts ?? 0) >= MAX_CODE_ATTEMPTS) throw new PrequalError("Too many wrong codes. Request a new one.", 429);
  if (!pending.code_expires_at || new Date(pending.code_expires_at).getTime() < Date.now()) throw new PrequalError("That code has expired. Request a new one.");
  if (!pending.code_hash || hashCode(input.code.trim(), pending.id) !== pending.code_hash) {
    await supabase.from("msa_signatures").update({ code_attempts: (pending.code_attempts ?? 0) + 1 }).eq("id", pending.id);
    throw new PrequalError("That code isn't right. Check the email and try again.");
  }

  const { data: version } = await supabase.from("msa_versions").select("*").eq("id", pending.msa_version_id).single();
  if (!version) throw new PrequalError("The agreement version is no longer available.", 409);
  const msaBytes = await download(version.storage_path);
  // The fingerprint is taken from the bytes actually stored, not trusted from the row.
  const docSha = sha256Hex(msaBytes);

  const now = new Date().toISOString();
  const sigPath = `${app.id}/msa-signature-${pending.id}.png`;
  await upload(sigPath, png, "image/png");

  const pdf = await buildSignedMsaPdf(msaBytes, {
    agreementLabel: `Master Subcontractor Agreement — ${version.label}`,
    docSha256: docSha,
    company: (app.answers?.company_name as string) || app.company_name,
    signerName: pending.signer_name, signerTitle: pending.signer_title, signerEmail: pending.signer_email,
    emailVerifiedAt: now, consentText: ESIGN_CONSENT_TEXT, signedAt: now,
    ip: input.ip, userAgent: input.userAgent, signaturePng: png,
  });
  const pdfPath = `${app.id}/msa-signed-${pending.id}.pdf`;
  await upload(pdfPath, pdf, "application/pdf");

  const { error } = await supabase.from("msa_signatures").update({
    code_hash: null, email_verified_at: now, consent_text: ESIGN_CONSENT_TEXT, consented_at: now,
    signature_path: sigPath, doc_sha256: docSha, ip: input.ip, user_agent: input.userAgent?.slice(0, 500) ?? null,
    signed_at: now, signed_pdf_path: pdfPath, updated_at: now,
  }).eq("id", pending.id);
  if (error) throw new PrequalError(error.message, 500);

  // Mirror into the draft so the form shows "signed" (the table stays the source of truth).
  await supabase.from("prequal_applications").update({
    answers: { ...app.answers, msa_signature: { signed: true, signer_name: pending.signer_name, signed_at: now, version: version.label } },
    updated_at: now,
  }).eq("id", app.id);

  return { signed_at: now };
}

/**
 * On submit: attach the signature to the company, file the executed PDF as a
 * compliance document, and send the copies. Never throws — a submission must
 * not fail over a copy email.
 */
export async function fileSignatureOnSubmit(app: Application, companyId: string): Promise<void> {
  try {
    const sig = await signatureForApplication(app.id);
    if (!sig?.signed_pdf_path) return;
    const supabase = getSupabaseAdmin();
    await supabase.from("msa_signatures").update({ company_id: companyId, updated_at: new Date().toISOString() }).eq("id", sig.id);
    const { data: version } = await supabase.from("msa_versions").select("label").eq("id", sig.msa_version_id).single();
    const fileName = `MSA_${fileLabel(version?.label)}_signed${sig.signed_at?.slice(0, 10)}.pdf`;
    await supabase.from("company_documents").insert({
      company_id: companyId, application_id: app.id, doc_type: "msa",
      label: `Master Subcontractor Agreement (${version?.label ?? "signed"})`,
      file_name: fileName, file_url: sig.signed_pdf_path, status: "uploaded",
      issued_on: sig.signed_at?.slice(0, 10), requested_at: sig.signed_at, uploaded_at: sig.signed_at,
      notes: "Signed electronically in the trade partner application. Awaiting Constructed Matter countersignature.",
    });
    const pdf = await download(sig.signed_pdf_path);
    await sendApplicantEmail({
      to: [sig.signer_email, "info@constructedmatter.com"],
      subject: "Your signed Constructed Matter Master Subcontractor Agreement",
      html: notificationEmailHtml({
    audience: "external", footerNote: TP_FOOTER,
        eyebrow: "Trade partner application",
        heading: "Your signed agreement",
        paragraphs: [
          `Thank you, ${sig.signer_name}. Attached is your signed copy of the ${version?.label ?? "Master Subcontractor Agreement"}.`,
          "We'll send the fully executed copy once Constructed Matter countersigns.",
        ],
      }),
      attachments: [{ filename: fileName, content: pdf }],
    });
  } catch (err) {
    console.error("[prequal] filing the MSA signature failed", err);
  }
}

/** Dashboard: countersign, regenerate the executed PDF, and send it to the signer. */
export async function countersign(signatureId: string, staff: { id: string; name: string }): Promise<MsaSignature> {
  const supabase = getSupabaseAdmin();
  const { data: sig } = await supabase.from("msa_signatures").select("*").eq("id", signatureId).single();
  if (!sig || !sig.signed_at) throw new PrequalError("That signature isn't complete.", 404);
  if (sig.countersigned_at) throw new PrequalError("Already countersigned.", 409);
  const { data: version } = await supabase.from("msa_versions").select("*").eq("id", sig.msa_version_id).single();
  if (!version) throw new PrequalError("The agreement version is missing.", 409);

  const now = new Date().toISOString();
  const msaBytes = await download(version.storage_path);
  const png = sig.signature_path ? await download(sig.signature_path).catch(() => null) : null;
  const { data: company } = sig.company_id ? await supabase.from("companies").select("name").eq("id", sig.company_id).maybeSingle() : { data: null };
  const pdf = await buildSignedMsaPdf(msaBytes, {
    agreementLabel: `Master Subcontractor Agreement — ${version.label}`, docSha256: sig.doc_sha256 ?? sha256Hex(msaBytes),
    company: company?.name ?? null, signerName: sig.signer_name, signerTitle: sig.signer_title, signerEmail: sig.signer_email,
    emailVerifiedAt: sig.email_verified_at ?? sig.signed_at, consentText: sig.consent_text ?? ESIGN_CONSENT_TEXT,
    signedAt: sig.signed_at, ip: sig.ip, userAgent: sig.user_agent, signaturePng: png,
    countersignerName: staff.name, countersignedAt: now,
  });
  const path = (sig.signed_pdf_path as string).replace(/\.pdf$/, "-executed.pdf");
  await upload(path, pdf, "application/pdf");

  const { data: updated, error } = await supabase.from("msa_signatures").update({
    countersigned_by: staff.id, countersigner_name: staff.name, countersigned_at: now, signed_pdf_path: path, updated_at: now,
  }).eq("id", sig.id).select().single();
  if (error) throw new PrequalError(error.message, 500);

  if (sig.company_id) {
    await supabase.from("company_documents").update({
      file_url: path, status: "verified", verified_by: staff.id, verified_at: now,
      notes: `Countersigned by ${staff.name}.`, updated_at: now,
    }).eq("company_id", sig.company_id).eq("doc_type", "msa").eq("file_url", sig.signed_pdf_path);
  }

  const fileName = `MSA_${fileLabel(version.label)}_executed${now.slice(0, 10)}.pdf`;
  await sendApplicantEmail({
    to: sig.signer_email,
    subject: "Fully executed: Constructed Matter Master Subcontractor Agreement",
    html: notificationEmailHtml({
    audience: "external", footerNote: TP_FOOTER,
      eyebrow: "Trade partner",
      heading: "Your agreement is fully executed",
      paragraphs: [`Hi ${sig.signer_name.split(" ")[0]}, Constructed Matter has countersigned your ${version.label}. A copy is attached for your records.`],
    }),
    attachments: [{ filename: fileName, content: pdf }],
  });
  return updated as MsaSignature;
}
