// Compliance document files after an application is submitted: the sub
// uploading what's missing (token link), the office uploading something a sub
// emailed in, and the onboarding guide PDF. Same bucket, same rules, same
// tracking as the application's own uploads. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl } from "@/lib/twilio";
import { PrequalError, type Application } from "./data";
import type { CompanyDocument } from "./review";

const BUCKET = "prequal-documents";
export const MAX_DOC_BYTES = 15 * 1024 * 1024;
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
const GUIDE_PATH = "onboarding/trade-partner-onboarding-guide.pdf";

/** The link a sub uses to send missing or renewed documents. The token is the credential. */
export function documentUploadUrl(app: Pick<Application, "token">): string {
  return `${publicAppUrl()}/prequalification/documents?t=${app.token}`;
}

export function checkDocFile(file: File): void {
  if (file.size > MAX_DOC_BYTES) throw new PrequalError("That file is larger than 15 MB.", 413);
  if (file.type && !ALLOWED_DOC_TYPES.includes(file.type)) throw new PrequalError("Upload a PDF or an image.", 415);
}

/**
 * Store a file against an existing company_documents row and reset it to
 * "uploaded" for review. A replacement clears the old expiry and any
 * rejection, since they described the previous file.
 */
export async function storeDocumentFile(docId: string, file: File, opts: { folder: string; uploadedBy?: string | null }): Promise<CompanyDocument> {
  checkDocFile(file);
  const supabase = getSupabaseAdmin();
  const { data: doc } = await supabase.from("company_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) throw new PrequalError("That document isn't on file.", 404);

  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${opts.folder}/${doc.doc_type}-${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream", upsert: true,
  });
  if (upErr) throw new PrequalError(upErr.message, 500);

  const now = new Date().toISOString();
  const { data, error } = await supabase.from("company_documents").update({
    file_url: path, file_name: file.name, status: "uploaded", uploaded_at: now,
    rejection_reason: null, verified_by: null, verified_at: null, expires_on: null,
    notes: opts.uploadedBy ? `Uploaded by office staff on ${now.slice(0, 10)}.` : `Uploaded by the trade partner on ${now.slice(0, 10)}.`,
    updated_at: now,
  }).eq("id", docId).select().single();
  if (error) throw new PrequalError(error.message, 500);
  return data as CompanyDocument;
}

/** What a sub still owes: requested, rejected, expired or expiring within 45 days. */
export function outstandingDocuments(docs: CompanyDocument[], today = new Date()): CompanyDocument[] {
  const soon = new Date(today.getTime() + 45 * 86_400_000).toISOString().slice(0, 10);
  return docs.filter((d) =>
    d.status === "requested" || d.status === "rejected" || d.status === "expired" ||
    (!!d.expires_on && d.expires_on <= soon));
}

// ─── Onboarding guide (one current PDF) ────────────────────────────────────

export async function onboardingGuide(): Promise<{ url: string | null; bytes: () => Promise<Uint8Array | null> }> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(GUIDE_PATH, 600);
  return {
    url: data?.signedUrl ?? null,
    bytes: async () => {
      const { data: blob } = await supabase.storage.from(BUCKET).download(GUIDE_PATH);
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    },
  };
}

export async function saveOnboardingGuide(file: File): Promise<void> {
  if (file.type && file.type !== "application/pdf") throw new PrequalError("Upload the guide as a PDF.", 415);
  if (file.size > 25 * 1024 * 1024) throw new PrequalError("That file is larger than 25 MB.", 413);
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(GUIDE_PATH, new Uint8Array(await file.arrayBuffer()), {
    contentType: "application/pdf", upsert: true,
  });
  if (error) throw new PrequalError(error.message, 500);
}
