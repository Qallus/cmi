// Staff notification center feed. GET lists the current unread notifications
// (the items behind the top-bar bell badge); PATCH marks one — or all — read.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  loadStaffNotifications,
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
  type StaffNotificationKind,
} from "@/lib/notifications/staff";

const KINDS: StaffNotificationKind[] = ["submission", "message", "lead", "note", "booking", "dm", "broadcast"];

function ctxFrom(user: { email?: string | null }, staff: { id: string; role_slug: string }) {
  return {
    email: user.email ?? "",
    staffId: staff.id,
    isAdmin: ["super_admin", "admin"].includes(staff.role_slug),
    role: staff.role_slug,
  };
}

export async function GET(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    const items = await loadStaffNotifications(ctxFrom(user, staff));
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ items: [], count: 0 }, { status: error.status });
    return NextResponse.json({ items: [], count: 0 }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    const ctx = ctxFrom(user, staff);
    const body = (await request.json().catch(() => ({}))) as { all?: boolean; kind?: string; id?: string };

    if (body.all) {
      const n = await markAllStaffNotificationsRead(ctx);
      return NextResponse.json({ ok: true, marked: n });
    }

    const kind = body.kind as StaffNotificationKind | undefined;
    if (!kind || !KINDS.includes(kind) || !body.id) {
      return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
    }
    const ok = await markStaffNotificationRead(ctx, kind, body.id);
    return NextResponse.json({ ok });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to update notification." }, { status: 500 });
  }
}
