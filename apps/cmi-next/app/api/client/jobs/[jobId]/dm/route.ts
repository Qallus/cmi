import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, getJobPerms, ClientAuthError } from "@/lib/client-portal/auth";
import { findOrCreateClientPmConversation, getThread, sendMessage } from "@/lib/direct-messages/data";

// Client↔PM direct message thread for a job. GET loads (or creates) the thread
// with the job's project team; POST sends a message as the client.
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId } = await params;
    await assertJobAccess(contact.id, jobId);
    const conversationId = await findOrCreateClientPmConversation(contact.id, jobId);
    const thread = await getThread(contact.id, conversationId);
    return NextResponse.json({ conversationId, conversation: thread?.conversation ?? { id: conversationId, other: null }, messages: thread?.messages ?? [] });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message ?? "Failed to load messages." }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId } = await params;
    await assertJobAccess(contact.id, jobId);
    const perms = await getJobPerms(contact.id, jobId);
    if (perms.messages === false) return NextResponse.json({ error: "Messaging is not enabled for your account." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { body?: string; attachments?: unknown[] };
    if (!body.body?.trim() && !body.attachments?.length) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
    const conversationId = await findOrCreateClientPmConversation(contact.id, jobId);
    const result = await sendMessage(contact.id, conversationId, { body: String(body.body ?? ""), attachments: body.attachments }, "client");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message ?? "Failed to send." }, { status: e.status ?? 500 });
  }
}
