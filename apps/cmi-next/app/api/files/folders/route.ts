// Create a folder.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createFolder } from "@/lib/files/data";

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = await request.json() as { name: string; project_id?: string | null; job_id?: string | null; parent_id?: string | null };
    if (!body.name?.trim()) return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    const folder = await createFolder(body, staff.id);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
