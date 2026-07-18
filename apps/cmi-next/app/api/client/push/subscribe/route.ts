// Store / remove the current client's Web Push subscription.
import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";
import { saveClientPushSubscription, removePushSubscription, type PushSubscriptionInput } from "@/lib/push/web-push";

export async function POST(request: Request) {
  try {
    const { contact } = await requireClient(request);
    const body = (await request.json().catch(() => ({}))) as { subscription?: PushSubscriptionInput };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "A valid push subscription is required." }, { status: 400 });
    }
    await saveClientPushSubscription(contact.id, sub, request.headers.get("user-agent"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireClient(request);
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (!body.endpoint) return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
    await removePushSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}
