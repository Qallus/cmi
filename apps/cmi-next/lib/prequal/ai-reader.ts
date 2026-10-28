// Claude reads each compliance document as it arrives (trade partner brief
// §7.2): every coverage line on a COI with carrier, policy, dates and limits,
// checked against CMI's minimums; W-9 classification and signature; license
// number and expiry. Results land on the company_documents row so nobody
// re-types them. The office still verifies — AI never marks a document
// verified. Server-only.
//
// Privacy: W-9s carry a TIN/SSN. The prompt forbids transcribing it and the
// schema has no field for it; we only record whether one is present.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { minimumsForCompany } from "./minimums";
import { checkMinimums, earliestExpiration, LINE_LABEL, type Coverage } from "./coverage";

const BUCKET = "prequal-documents";
const MODEL = "claude-opus-5-5";
const COI_TYPES = new Set(["coi", "gl", "wc", "auto"]);
const READABLE = new Set(["coi", "gl", "wc", "auto", "w9", "license"]);

export function aiReaderConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const nullableStr = z.string().nullable();
const nullableNum = z.number().nullable();

const CoiSchema = z.object({
  is_certificate_of_insurance: z.boolean(),
  insured_name: nullableStr,
  producer: nullableStr,
  certificate_date: nullableStr,
  constructed_matter_additional_insured: z.boolean().nullable(),
  coverages: z.array(z.object({
    line: z.enum(["general_liability", "auto", "workers_comp", "umbrella", "professional", "other"]),
    carrier: nullableStr,
    policy_number: nullableStr,
    effective_date: nullableStr,
    expiration_date: nullableStr,
    each_occurrence: nullableNum,
    aggregate: nullableNum,
    combined_single_limit: nullableNum,
    employers_liability_each_accident: nullableNum,
  })),
  notes: nullableStr,
});

const W9Schema = z.object({
  is_w9: z.boolean(),
  legal_name: nullableStr,
  business_name: nullableStr,
  federal_tax_classification: z.enum([
    "individual_sole_proprietor", "c_corporation", "s_corporation", "partnership", "trust_estate",
    "llc_c_corporation", "llc_s_corporation", "llc_partnership", "llc_single_member", "other", "unknown",
  ]),
  is_signed: z.boolean(),
  signed_date: nullableStr,
  form_revision: nullableStr,
  taxpayer_id_present: z.boolean(),
  notes: nullableStr,
});

const LicenseSchema = z.object({
  is_contractor_license: z.boolean(),
  holder_name: nullableStr,
  license_number: nullableStr,
  classification: nullableStr,
  state: nullableStr,
  expiration_date: nullableStr,
  notes: nullableStr,
});

const PROMPTS: Record<"coi" | "w9" | "license", string> = {
  coi:
    "This should be a certificate of insurance (usually an ACORD 25) for a construction subcontractor working for Constructed Matter, Inc. " +
    "Extract every coverage line. Use YYYY-MM-DD for dates and whole US dollars for limits (\"$1,000,000\" → 1000000). " +
    "Use null for anything not on the document; never guess. For workers' comp put the employer's liability each-accident limit in employers_liability_each_accident. " +
    "Set constructed_matter_additional_insured to true only if Constructed Matter is named as additional insured or as the certificate holder with additional-insured wording, false if clearly not, null if unclear.",
  w9:
    "This should be an IRS Form W-9. Extract the legal name, business name, federal tax classification, whether it is signed, the signature date (YYYY-MM-DD) and the form revision (e.g. \"Rev. March 2024\"). " +
    "Do NOT transcribe the taxpayer identification number (SSN or EIN) anywhere in your answer; only report whether one is filled in.",
  license:
    "This should be a contractor license (for example an Arizona ROC license). Extract the holder, license number, classification, issuing state and expiration date (YYYY-MM-DD). Use null for anything not on the document.",
};

function mediaType(path: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

const CLASSIFICATION_TO_STRUCTURE: Record<string, string> = {
  individual_sole_proprietor: "Sole proprietor", llc_single_member: "LLC", llc_c_corporation: "LLC",
  llc_s_corporation: "LLC", llc_partnership: "LLC", c_corporation: "C Corporation", s_corporation: "S Corporation",
  partnership: "Partnership",
};

const usd = (n: number | null) => (n == null ? "?" : n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n.toLocaleString("en-US")}`);

/** Run after the response is sent, so uploads stay fast. Never throws. */
export function queueDocumentRead(docId: string | null | undefined): void {
  if (!docId || !aiReaderConfigured()) return;
  try {
    after(async () => { await readDocument(docId).catch((err) => console.error("[ai-reader]", docId, err)); });
  } catch {
    // Outside a request (scripts): read inline.
    void readDocument(docId).catch((err) => console.error("[ai-reader]", docId, err));
  }
}

export async function readDocument(docId: string): Promise<{ status: string; summary?: string | null; flags?: string[]; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: doc } = await supabase.from("company_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) return { status: "failed", error: "Document not found." };
  const kind = COI_TYPES.has(doc.doc_type) ? "coi" : doc.doc_type === "w9" ? "w9" : doc.doc_type === "license" ? "license" : null;
  const mark = async (patch: Record<string, unknown>) =>
    supabase.from("company_documents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", docId);

  if (!kind || !READABLE.has(doc.doc_type) || !doc.file_url) return { status: "skipped" };
  if (!aiReaderConfigured()) { await mark({ ai_status: "skipped", ai_error: "ANTHROPIC_API_KEY is not configured." }); return { status: "skipped" }; }
  const media = mediaType(String(doc.file_name ?? doc.file_url));
  if (!media) {
    await mark({ ai_status: "skipped", ai_error: "Only PDF, JPG, PNG and WebP files can be read automatically." });
    return { status: "skipped", error: "Unsupported file type." };
  }

  await mark({ ai_status: "pending", ai_error: null });
  try {
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(doc.file_url);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "Couldn't download the file.");
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const fileBlock: Anthropic.Beta.BetaContentBlockParam = media === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: media, data } };
    const schema = kind === "coi" ? CoiSchema : kind === "w9" ? W9Schema : LicenseSchema;

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPTS[kind] }] }],
    });
    if (response.stop_reason === "refusal") throw new Error("The document couldn't be read automatically.");
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("The reader didn't return a usable result.");

    const now = new Date().toISOString();
    if (kind === "coi") {
      const p = parsed as z.infer<typeof CoiSchema>;
      if (!p.is_certificate_of_insurance) {
        await mark({ ai_status: "parsed", ai_parsed_at: now, ai_model: response.model, ai_summary: "This doesn't look like a certificate of insurance.", ai_flags: ["Not a certificate of insurance. Ask the sub for their COI."], coverages: [] });
        return { status: "parsed", flags: ["Not a certificate of insurance."] };
      }
      // The minimums for this partner's type and trades (Trade Partners → Setup).
      const { coverages, flags } = checkMinimums(p.coverages as Coverage[], await minimumsForCompany(doc.company_id));
      if (p.constructed_matter_additional_insured === false) flags.push("Constructed Matter isn't listed as additional insured.");
      const gl = coverages.find((c) => c.line === "general_liability");
      const summary = coverages.map((c) => `${LINE_LABEL[c.line]}: ${c.carrier ?? "carrier ?"}, ${
        c.line === "general_liability" ? `${usd(c.each_occurrence)}/${usd(c.aggregate)}`
          : c.line === "workers_comp" ? `EL ${usd(c.employers_liability_each_accident)}`
          : usd(c.combined_single_limit ?? c.each_occurrence)}, expires ${c.expiration_date ?? "?"}`).join(" · ");
      await mark({
        ai_status: "parsed", ai_parsed_at: now, ai_model: response.model, ai_error: null,
        coverages, ai_flags: flags, ai_summary: summary || "No coverage lines found.",
        expires_on: earliestExpiration(coverages) ?? doc.expires_on,
        issued_on: p.certificate_date && /^\d{4}-\d{2}-\d{2}$/.test(p.certificate_date) ? p.certificate_date : doc.issued_on,
        carrier: gl?.carrier ?? coverages[0]?.carrier ?? doc.carrier,
        policy_number: gl?.policy_number ?? coverages[0]?.policy_number ?? doc.policy_number,
        coverage_amount: gl?.each_occurrence ?? doc.coverage_amount,
      });
      return { status: "parsed", summary, flags };
    }

    if (kind === "w9") {
      const p = parsed as z.infer<typeof W9Schema>;
      const flags: string[] = [];
      if (!p.is_w9) flags.push("Not a W-9. Ask the sub for a completed W-9.");
      if (p.is_w9 && !p.is_signed) flags.push("The W-9 isn't signed.");
      if (p.is_w9 && !p.taxpayer_id_present) flags.push("No taxpayer ID is filled in.");
      if (p.is_w9 && p.federal_tax_classification === "unknown") flags.push("No federal tax classification is checked.");
      const structure = CLASSIFICATION_TO_STRUCTURE[p.federal_tax_classification] ?? null;
      const summary = p.is_w9
        ? [p.legal_name, p.business_name && p.business_name !== p.legal_name ? `dba ${p.business_name}` : null,
          p.federal_tax_classification.replace(/_/g, " "), p.is_signed ? `signed ${p.signed_date ?? ""}`.trim() : "unsigned", p.form_revision].filter(Boolean).join(" · ")
        : "This doesn't look like a W-9.";
      await mark({ ai_status: "parsed", ai_parsed_at: now, ai_model: response.model, ai_error: null, ai_flags: flags, ai_summary: summary, issued_on: p.signed_date && /^\d{4}-\d{2}-\d{2}$/.test(p.signed_date) ? p.signed_date : doc.issued_on });
      // Fill the 1099 business structure if the company never said.
      if (structure && doc.company_id) {
        await supabase.from("companies").update({ business_structure: structure }).eq("id", doc.company_id).is("business_structure", null);
      }
      return { status: "parsed", summary, flags };
    }

    const p = parsed as z.infer<typeof LicenseSchema>;
    const flags: string[] = [];
    if (!p.is_contractor_license) flags.push("This doesn't look like a contractor license.");
    if (p.expiration_date && p.expiration_date < now.slice(0, 10)) flags.push(`The license expired on ${p.expiration_date}.`);
    const summary = [p.holder_name, p.license_number, p.classification, p.state, p.expiration_date ? `expires ${p.expiration_date}` : null].filter(Boolean).join(" · ");
    await mark({
      ai_status: "parsed", ai_parsed_at: now, ai_model: response.model, ai_error: null, ai_flags: flags, ai_summary: summary,
      expires_on: p.expiration_date && /^\d{4}-\d{2}-\d{2}$/.test(p.expiration_date) ? p.expiration_date : doc.expires_on,
      license_number: p.license_number ?? doc.license_number, license_class: p.classification ?? doc.license_class, license_state: p.state ?? doc.license_state,
    });
    return { status: "parsed", summary, flags };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await mark({ ai_status: "failed", ai_error: message.slice(0, 500) });
    return { status: "failed", error: message };
  }
}
