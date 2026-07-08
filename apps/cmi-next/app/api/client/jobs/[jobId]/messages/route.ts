// Client posts a message on their job (client-visible thread).
import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, getJobPerms, ClientAuthError } from "@/lib/client-portal/auth";
import { postClientMessage } from "@/lib/client-portal/data";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId } = await params;
    await assertJobAccess(contact.id, jobId);
    const perms = await getJobPerms(contact.id, jobId);
    if (perms.messages === false) return NextResponse.json({ error: "Messaging is not enabled for your account." }, { status: 403 });

    const { body, category } = await request.json() as { body?: string; category?: string };
    if (!body?.trim()) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
    return NextResponse.json(await postClientMessage(jobId, contact, body.trim(), category), { status: 201 });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
