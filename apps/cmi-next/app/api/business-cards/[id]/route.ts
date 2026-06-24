import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { deleteCard, reassignCard, setCardStatus } from "@/lib/business-cards/data";
import type { CardStatus } from "@/lib/business-cards/types";

const ADMIN_ROLES = ["super_admin", "admin"];
const VALID_STATUS: CardStatus[] = ["draft", "published", "unpublished", "archived"];

async function authorize(request: Request, id: string) {
  const { staff } = await requireAdmin(request);
  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  const { data } = await getSupabaseAdmin()
    .from("business_cards").select("staff_user_id").eq("id", id).maybeSingle();
  if (!data) throw new AuthError("Card not found.", 404);
  if (!isAdmin && data.staff_user_id !== staff.id) {
    throw new AuthError("You can only manage your own card.", 403);
  }
  return { staff, isAdmin };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let isAdmin = false;
  try {
    ({ isAdmin } = await authorize(request, id));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = await request.json().catch(() => null) as { status?: CardStatus; staff_user_id?: string | null } | null;
  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    if (body.status) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      await setCardStatus(id, body.status);
    }
    if (body.staff_user_id !== undefined) {
      if (!isAdmin) return NextResponse.json({ error: "Only admins can reassign cards." }, { status: 403 });
      await reassignCard(id, body.staff_user_id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await authorize(request, id);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  try {
    await deleteCard(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 400 });
  }
}
