// Executes a confirmed pending action (delete or send) that Bolt staged.
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { executePending } from "@/lib/agent/tools";
import type { PendingAction, StaffContext } from "@/lib/agent/types";

const ADMIN_ROLES = ["super_admin", "admin"];

export async function POST(req: NextRequest) {
  let user, staff;
  try {
    ({ user, staff } = await requireAdmin(req));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = await req.json().catch(() => null) as { action?: PendingAction } | null;
  if (!body?.action) return NextResponse.json({ error: "action is required." }, { status: 400 });

  const ctx: StaffContext = {
    id: staff.id,
    email: user.email ?? "",
    displayName: (staff as { display_name?: string }).display_name || user.email || "Staff",
    role: staff.role_slug,
    isAdmin: ADMIN_ROLES.includes(staff.role_slug),
  };

  const result = await executePending(body.action, ctx);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ result });
}
