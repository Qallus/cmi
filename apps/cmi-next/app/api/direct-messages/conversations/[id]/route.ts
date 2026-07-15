import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getThread, sendMessage } from "@/lib/direct-messages/data";

// Full thread (marks read for the requester).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const thread = await getThread(staff.id, id);
    if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to load thread." }, { status: 500 });
  }
}

// Send a message into the conversation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: string; importance?: "normal" | "important" | "urgent"; attachments?: unknown[] };
    const result = await sendMessage(staff.id, id, { body: String(body.body ?? ""), importance: body.importance, attachments: body.attachments });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send message." }, { status: 400 });
  }
}
