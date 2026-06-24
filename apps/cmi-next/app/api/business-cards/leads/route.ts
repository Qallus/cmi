import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadLeads } from "@/lib/business-cards/data";

const ADMIN_ROLES = ["super_admin", "admin"];

export async function GET(request: Request) {
  let staff;
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  const all = isAdmin && new URL(request.url).searchParams.get("scope") === "all";

  try {
    const leads = await loadLeads({ all, staffId: staff.id });
    return NextResponse.json({ leads });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load leads." }, { status: 500 });
  }
}
