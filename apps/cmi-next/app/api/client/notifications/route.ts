import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";
import { loadClientNotifications, markNotificationsRead } from "@/lib/client-portal/notifications";

export async function GET(request: Request) {
  try {
    const { contact } = await requireClient(request);
    return NextResponse.json(await loadClientNotifications(contact.id));
  } catch (err) { const e = err as ClientAuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
}

// Mark read: body { ids?: string[] } — omit to mark all read.
export async function PATCH(request: Request) {
  try {
    const { contact } = await requireClient(request);
    const body = await request.json().catch(() => ({})) as { ids?: string[] };
    await markNotificationsRead(contact.id, body.ids);
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as ClientAuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
}
