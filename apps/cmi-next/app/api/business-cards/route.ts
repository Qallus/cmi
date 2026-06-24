import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { computeStats, loadCardsForViewer, loadStaffOptions, saveCard } from "@/lib/business-cards/data";
import type { SaveCardPayload } from "@/lib/business-cards/types";

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
  const scope = new URL(request.url).searchParams.get("scope");
  const all = isAdmin && scope === "all";

  try {
    const cards = await loadCardsForViewer({ all, staffId: staff.id });
    const stats = await computeStats(cards);
    const staffOptions = isAdmin ? await loadStaffOptions() : [];
    return NextResponse.json({ cards, stats, role: staff.role_slug, staffId: staff.id, isAdmin, staffOptions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load cards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let staff;
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  const payload = (await request.json().catch(() => null)) as SaveCardPayload | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  // Ownership guard for non-admins editing an existing card.
  if (payload.id && !isAdmin) {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await getSupabaseAdmin()
      .from("business_cards").select("staff_user_id").eq("id", payload.id).maybeSingle();
    if (!data || data.staff_user_id !== staff.id) {
      return NextResponse.json({ error: "You can only edit your own card." }, { status: 403 });
    }
  }

  try {
    const card = await saveCard(payload, { ownerStaffId: staff.id, isAdmin });
    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}
