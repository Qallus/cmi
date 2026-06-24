import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadCardForEdit } from "@/lib/business-cards/data";

const ADMIN_ROLES = ["super_admin", "admin"];

export async function GET(request: Request) {
  let staff;
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const card = await loadCardForEdit(id);
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  if (!isAdmin && card.staff_user_id !== staff.id) {
    return NextResponse.json({ error: "You can only view your own card." }, { status: 403 });
  }

  return NextResponse.json({ card });
}
