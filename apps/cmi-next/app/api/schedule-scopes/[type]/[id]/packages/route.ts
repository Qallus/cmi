import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { applyPackage } from "@/lib/schedules/data";
import { readScope } from "../../../scope";

// POST: apply a Job Schedule Package to a job, deal, Pre-Con record or selection.
export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const r = await readScope(params);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const body = await request.json().catch(() => ({}));
    if (!body.packageId) return NextResponse.json({ error: "packageId is required." }, { status: 400 });
    const created = await applyPackage(r.scope, body.packageId, { id: staff.id }, {
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      autoCascade: body.autoCascade !== false,
    });
    return NextResponse.json({ ok: true, created });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
