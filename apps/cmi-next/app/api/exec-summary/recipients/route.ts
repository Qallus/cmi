// Who a summary can go to: GET ?target=job|precon&id=… → { staff, contacts, canSendToClient }.
import { NextResponse } from "next/server";
import { CLIENT_SEND_ROLES, loadRecipients } from "@/lib/exec-summary/deliver";
import { parseTarget, summaryError, summarySession } from "@/lib/exec-summary/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await summarySession(request);
    const sp = new URL(request.url).searchParams;
    const t = parseTarget(sp.get("target"), sp.get("id"));
    if (!t) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    return NextResponse.json({ ...(await loadRecipients(t.target, t.id)), canSendToClient: CLIENT_SEND_ROLES.includes(actor.role) });
  } catch (err) {
    return summaryError(err);
  }
}
