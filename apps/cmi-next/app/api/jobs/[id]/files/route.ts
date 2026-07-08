// Job files: list + multipart upload (to the shared cmi-media bucket).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobFiles, createJobFile } from "@/lib/job-files/data";
import { uploadToMedia } from "@/lib/storage";

export const runtime = "nodejs";
const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadJobFiles(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
    const folder = String(form.get("folder") || "General");
    const category = form.get("category") ? String(form.get("category")) : null;

    const uploaded = await uploadToMedia(file, `jobs/${id}`);
    const record = await createJobFile(id, {
      folder, name: uploaded.name, file_url: uploaded.url, mime_type: uploaded.mime, size_bytes: uploaded.size, category,
    }, user.email);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Upload failed." }, { status: e.status ?? 500 });
  }
}
