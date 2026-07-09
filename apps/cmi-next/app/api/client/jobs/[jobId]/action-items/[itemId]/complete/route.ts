// Client marks one of their own action items complete.
import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, ClientAuthError } from "@/lib/client-portal/auth";
import { completeActionItemForClient } from "@/lib/action-items/data";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string; itemId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId, itemId } = await params;
    await assertJobAccess(contact.id, jobId);
    return NextResponse.json(await completeActionItemForClient(itemId, contact.id));
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
