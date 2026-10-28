// After submitting, a trade partner sends missing, rejected or renewed
// documents through their application link (/prequalification/documents?t=…).
// The token is the credential, as for the application itself.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getByToken, PrequalError } from "@/lib/prequal/data";
import { outstandingDocuments, storeDocumentFile } from "@/lib/prequal/documents";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG, PREQUAL_DECIDE_ROLES } from "@/lib/prequal/access";
import { notifyStaff } from "@/lib/notifications/dispatch";
import type { CompanyDocument } from "@/lib/prequal/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

async function context(token: string) {
  const app = await getByToken(token);
  if (!app) throw new PrequalError("That link is no longer valid.", 404);
  if (app.status === "draft") throw new PrequalError("Finish and submit your application first.", 409);
  if (app.status === "declined" || app.status === "withdrawn") throw new PrequalError("This application is closed. Email info@constructedmatter.com if you'd like to reapply.", 410);
  if (!app.company_id) throw new PrequalError("We couldn't find your company record. Email info@constructedmatter.com.", 409);
  const { data } = await getSupabaseAdmin().from("company_documents").select("*").eq("company_id", app.company_id).order("doc_type");
  return { app, docs: (data ?? []) as CompanyDocument[] };
}

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { app, docs } = await context((await params).token);
    const owed = new Set(outstandingDocuments(docs).map((d) => d.id));
    return NextResponse.json({
      company: app.company_name,
      documents: docs.filter((d) => d.doc_type !== "msa").map((d) => ({
        id: d.id, label: d.label || d.doc_type, status: d.status, expires_on: d.expires_on,
        file_name: d.file_name, rejection_reason: d.rejection_reason, needed: owed.has(d.id),
      })),
    });
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: Ctx) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { app, docs } = await context((await params).token);
    const form = await request.formData();
    const file = form.get("file");
    const docId = String(form.get("document_id") ?? "");
    const doc = docs.find((d) => d.id === docId && d.doc_type !== "msa");
    if (!doc) return NextResponse.json({ error: "Which document is this?" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    const saved = await storeDocumentFile(doc.id, file, { folder: app.id });

    // Let the office know there's something to review (once per document per day).
    const { data: staff } = await getSupabaseAdmin().from("staff_users").select("id").in("role_slug", [...PREQUAL_DECIDE_ROLES]).in("status", ["active", "invited"]);
    await notifyStaff({
      recipientIds: (staff ?? []).map((s) => s.id as string),
      kind: "prequal_document_uploaded",
      title: `${app.company_name ?? "A trade partner"} uploaded ${saved.label ?? saved.doc_type}`,
      url: "/dashboard/trade-partners",
      sourceTable: "company_documents", sourceId: saved.id,
      dedupeKey: `prequal_doc_uploaded:${saved.id}:${new Date().toISOString().slice(0, 10)}`,
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: saved.status, file_name: saved.file_name });
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
