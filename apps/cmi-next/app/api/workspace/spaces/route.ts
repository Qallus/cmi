import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { listWorkspaces, createWorkspace } from "@/lib/workspace/repository";

export async function GET(request: Request) {
  try {
    await requireWorkspaceAccess(request);
    const workspaces = await listWorkspaces();
    return NextResponse.json({ ok: true, workspaces });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workspaces.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireWorkspaceAccess(request, body.actionToken);
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    const workspace = await createWorkspace(name, actor.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create workspace.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
