// Persist a hand-dragged order in one call:
//   POST { items: [{ id, sort_order }] }
//
// Mirrors /api/files/reorder. Writing every visible row's position rather than
// just the moved one keeps the sequence dense, so repeated drags cannot drift
// into collisions.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { canWriteDeals } from "@/lib/deals/roles";

export const dynamic = "force-dynamic";
const MAX_ITEMS = 500;

type Item = { id: string; sort_order: number };

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: "You cannot reorder the pipeline." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
    const items = (body?.items ?? []).filter(
      (i) => i && typeof i.id === "string" && Number.isFinite(i.sort_order),
    );
    if (!items.length) return NextResponse.json({ error: "No items to reorder." }, { status: 400 });
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: `Reorder up to ${MAX_ITEMS} deals at a time.` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let updated = 0;
    for (const item of items) {
      const { error } = await supabase
        .from("deals")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
      if (!error) updated += 1;
    }
    return NextResponse.json({ updated });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
