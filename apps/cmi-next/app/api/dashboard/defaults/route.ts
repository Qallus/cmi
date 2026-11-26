// The company default Overview for people who haven't set theirs up.
// Super Admin only. { layout } saves a layout; { preset: "standard" | "blank" |
// "chooser" } sets a preset (and clears any saved layout).
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { requireDashboard, dashboardError } from "@/lib/dashboard/guard";
import { canSetDashboardDefault } from "@/lib/dashboard/access";
import { normalize } from "@/lib/dashboard/layout";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const { staffId, role } = await requireDashboard(req);
    if (!canSetDashboardDefault(role)) throw new AuthError("Only a Super Admin can set the company default.", 403);
    const body = (await req.json().catch(() => ({}))) as { layout?: unknown; preset?: unknown };
    const row: Record<string, unknown> = { id: true, updated_by: staffId, updated_at: new Date().toISOString() };
    if (body.layout !== undefined) {
      const layout = normalize(body.layout);
      if (!layout) return NextResponse.json({ error: "That layout couldn't be read." }, { status: 400 });
      row.layout = layout;
      row.preset = layout.template;
    } else if (body.preset === "standard" || body.preset === "blank" || body.preset === "chooser") {
      row.preset = body.preset;
      row.layout = null;
    } else {
      return NextResponse.json({ error: "Send a layout or a preset." }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from("dashboard_defaults").upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dashboardError(err);
  }
}
