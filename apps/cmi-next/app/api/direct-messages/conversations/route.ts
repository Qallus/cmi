import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { listConversations, findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";

// List the current staff user's conversations.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const url = new URL(request.url);
    const conversations = await listConversations(staff.id, {
      search: url.searchParams.get("search") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      jobId: url.searchParams.get("job_id") ?? undefined,
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ conversations: [] }, { status: error.status });
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }
}

// Start (or reuse) a conversation with another staff member; optional first message.
export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { otherUserId?: string; job_id?: string | null; body?: string; importance?: "normal" | "important" | "urgent"; attachments?: unknown[] };
    const otherUserId = String(body.otherUserId || "");
    if (!otherUserId) return NextResponse.json({ error: "Recipient is required." }, { status: 400 });
    const conversationId = await findOrCreateConversation({ id: staff.id, kind: "staff" }, { id: otherUserId, kind: "staff" }, body.job_id ?? null);
    if (body.body && body.body.trim()) {
      await sendMessage(staff.id, conversationId, { body: body.body, importance: body.importance, attachments: body.attachments });
    }
    return NextResponse.json({ conversationId });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start conversation." }, { status: 400 });
  }
}
