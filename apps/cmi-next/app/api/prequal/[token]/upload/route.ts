// Document upload from the public application.
//
// Goes through the app rather than a presigned URL: the applicant is
// anonymous, so handing out storage credentials is not on. Size and type are
// checked here, and the bytes land in the same private Supabase bucket the
// rest of the app uses.
import { NextResponse } from "next/server";
import { getByToken } from "@/lib/prequal/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "prequal-documents";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const { token } = await params;
    const app = await getByToken(token);
    if (!app) return NextResponse.json({ error: "That application link is no longer valid." }, { status: 404 });
    if (app.status !== "draft") return NextResponse.json({ error: "This application has already been submitted." }, { status: 409 });

    const form = await request.formData();
    const file = form.get("file");
    const docType = String(form.get("doc_type") ?? "").replace(/[^a-z0-9_]/gi, "");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    if (!docType) return NextResponse.json({ error: "Which document is this?" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is larger than 15 MB." }, { status: 413 });
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Upload a PDF or an image." }, { status: 415 });
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${app.id}/${docType}-${Date.now()}-${safeName}`;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      doc_type: docType,
      name: file.name,
      size: file.size,
      path,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  }
}
