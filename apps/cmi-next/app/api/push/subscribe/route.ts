import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { savePushSubscription, removePushSubscription, type PushSubscriptionInput } from "@/lib/push/web-push";

// Store the current staff member's Web Push subscription.
export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { subscription?: PushSubscriptionInput };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "A valid push subscription is required." }, { status: 400 });
    }
    await savePushSubscription(staff.id, sub, request.headers.get("user-agent"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
  }
}

// Remove a subscription (on disable / logout).
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (!body.endpoint) return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
    await removePushSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to remove subscription." }, { status: 500 });
  }
}
