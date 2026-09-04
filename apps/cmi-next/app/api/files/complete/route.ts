// Finalize an upload: complete multipart (if any), verify the object exists, then
// insert the files row. No DB row is created without a real object in Garage.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { insertFile } from "@/lib/files/data";
import { completeMultipart, objectExists, StorageNotConfiguredError } from "@/lib/files/s3";

type Body = {
  key: string; name: string; mime?: string; size?: number;
  projectId?: string | null; jobId?: string | null; folderId?: string | null; thumbnailKey?: string | null;
  multipart?: { uploadId: string; parts: { PartNumber: number; ETag: string }[] };
};

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = (await request.json()) as Body;
    if (!body.key || !body.name) return NextResponse.json({ error: "key and name are required." }, { status: 400 });

    if (body.multipart?.uploadId) {
      const parts = (body.multipart.parts || []).filter((p) => p.ETag && p.PartNumber);
      if (!parts.length) return NextResponse.json({ error: "No uploaded parts to complete." }, { status: 400 });
      await completeMultipart(body.key, body.multipart.uploadId, parts);
    }

    if (!(await objectExists(body.key))) {
      return NextResponse.json({ error: "Upload not found in storage. Aborting." }, { status: 400 });
    }

    const file = await insertFile({
      name: body.name,
      storage_key: body.key,
      thumbnail_key: body.thumbnailKey ?? null,
      mime_type: body.mime ?? null,
      size_bytes: body.size ?? null,
      project_id: body.projectId ?? null,
      job_id: body.jobId ?? null,
      folder_id: body.folderId ?? null,
      uploaded_by: staff.id,
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
