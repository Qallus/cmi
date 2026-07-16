import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobNotes, createJobNote } from "@/lib/job-notes/data";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json({ notes: await loadJobNotes(id) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: string };
    const note = await createJobNote(id, String(body.body ?? ""), { id: staff.id, email: user.email });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 400 });
  }
}
