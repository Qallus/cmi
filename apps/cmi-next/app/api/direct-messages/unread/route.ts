import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getUnreadCount } from "@/lib/direct-messages/data";

// Total unread DM count for the current staff user (bell / FAB badge).
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const count = await getUnreadCount(staff.id);
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ count: 0 }, { status: error.status });
    return NextResponse.json({ count: 0 });
  }
}
