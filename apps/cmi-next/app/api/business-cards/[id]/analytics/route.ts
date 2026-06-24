import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadCardAnalytics } from "@/lib/business-cards/data";

const ADMIN_ROLES = ["super_admin", "admin"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const { data: card } = await getSupabaseAdmin()
    .from("business_cards").select("staff_user_id").eq("id", id).maybeSingle();
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  if (!isAdmin && card.staff_user_id !== staff.id) {
    return NextResponse.json({ error: "You can only view analytics for your own card." }, { status: 403 });
  }

  const range = Math.min(Math.max(Number(new URL(request.url).searchParams.get("range") || "30"), 7), 90);
  try {
    const analytics = await loadCardAnalytics(id, range);
    return NextResponse.json({ analytics });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load analytics." }, { status: 500 });
  }
}
