// Save your own Overview layout. Cards your role can't use are dropped.
import { NextResponse } from "next/server";
import { requireDashboard, dashboardError } from "@/lib/dashboard/guard";
import { cardAllowed } from "@/lib/dashboard/access";
import { normalize } from "@/lib/dashboard/layout";
import { saveDashboardLayout } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const { staffId, role, flags } = await requireDashboard(req);
    const body = (await req.json().catch(() => ({}))) as { layout?: unknown };
    const layout = normalize(body.layout, (t) => cardAllowed(t, role, flags));
    if (!layout) return NextResponse.json({ error: "That layout couldn't be read." }, { status: 400 });
    if (JSON.stringify(layout).length > 250_000) return NextResponse.json({ error: "That layout is too big." }, { status: 413 });
    await saveDashboardLayout(staffId, layout);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dashboardError(err);
  }
}
