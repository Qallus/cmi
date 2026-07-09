import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";
import { unreadNotificationCount } from "@/lib/client-portal/notifications";

export async function GET(request: Request) {
  try {
    const { contact } = await requireClient(request);
    return NextResponse.json({ count: await unreadNotificationCount(contact.id) });
  } catch (err) { const e = err as ClientAuthError; return NextResponse.json({ count: 0 }, { status: e.status ?? 401 }); }
}
