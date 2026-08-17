import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { applyPackage } from "@/lib/schedules/data";

// POST: apply a Job Schedule Package — creates all its schedules at once.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!body.packageId) return NextResponse.json({ error: "packageId is required." }, { status: 400 });
    const created = await applyPackage(id, body.packageId, { id: staff.id });
    return NextResponse.json({ ok: true, created });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
