import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadStaffNotifications } from "@/lib/notifications/staff";

/**
 * The bell badge.
 *
 * This used to re-implement the counting itself, in parallel with
 * loadStaffNotifications, and the two drifted: the badge counted rows the list
 * filtered out, so it could show a number against an empty dropdown. Counting
 * the list is a little more work per poll and cannot disagree with what the
 * user then sees.
 */
export async function GET(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    const items = await loadStaffNotifications({
      email: user.email ?? "",
      staffId: staff.id,
      isAdmin: ["super_admin", "admin"].includes(staff.role_slug),
      role: staff.role_slug,
    });
    return NextResponse.json({ count: items.length });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ count: 0 }, { status: error.status });
    return NextResponse.json({ count: 0 });
  }
}
