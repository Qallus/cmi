// Staff view + reply on a job's client message thread (lib/job-messages/data.ts,
// shared with Claude).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobMessages, postJobMessage } from "@/lib/job-messages/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    // Viewing the thread marks the client's unread messages read.
    return NextResponse.json(await loadJobMessages(id, { markRead: true }));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { body, visibility, category } = await request.json() as { body?: string; visibility?: string; category?: string };
    if (!body?.trim()) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
    const data = await postJobMessage(id, { body, visibility, category }, { id: staff.id, name: user.email ?? "Staff" });
    return NextResponse.json(data, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
