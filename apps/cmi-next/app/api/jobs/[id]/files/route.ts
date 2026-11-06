// Job files: list + multipart upload (to the shared cmi-media bucket).
import { recordPhotos } from "@/lib/photos/data";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobFiles, createJobFile, setJobFilesClientVisible } from "@/lib/job-files/data";
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
    const clientVisible = form.get("client_visible") === "true";

    const uploaded = await uploadToMedia(file, `jobs/${id}`);
    const record = await createJobFile(id, {
      folder, name: uploaded.name, file_url: uploaded.url, mime_type: uploaded.mime, size_bytes: uploaded.size, category, client_visible: clientVisible,
    }, user.email);
    // Field Reports: images also land in the job's Photos library.
    if (uploaded.mime?.startsWith("image/")) await recordPhotos(id, [uploaded.url], { source_type: "job_file", source_id: (record as { id?: string }).id ?? null, uploaded_by: user.email ?? null, uploaded_by_id: staff.id, client_ok: clientVisible, caption: uploaded.name });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Upload failed." }, { status: e.status ?? 500 });
  }
}

// Share / hide files in the client portal: { ids: string[], client_visible: boolean }.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json() as { ids?: unknown; client_visible?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0 || typeof body.client_visible !== "boolean") {
      return NextResponse.json({ error: "ids and client_visible are required." }, { status: 400 });
    }
    return NextResponse.json(await setJobFilesClientVisible(id, ids, body.client_visible));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
