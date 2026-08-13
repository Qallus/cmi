import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { getSharing, addCollaborator, removeCollaborator } from "@/lib/workspace/repository";

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Sharing action failed.";
  const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSuperAdmin(request);
    const data = await getSharing(id);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    if (!body.userId) return NextResponse.json({ error: "A user is required." }, { status: 400 });
    const permission = ["editor", "commenter", "viewer"].includes(body.permission) ? body.permission : "editor";
    await addCollaborator(id, String(body.userId), actor.id, permission);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await requireSuperAdmin(request, body.actionToken);
    if (!body.userId) return NextResponse.json({ error: "A user is required." }, { status: 400 });
    await removeCollaborator(id, String(body.userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
