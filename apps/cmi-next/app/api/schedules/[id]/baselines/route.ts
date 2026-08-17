import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canManageSchedules } from "@/lib/schedules/permissions";
import { captureBaseline } from "@/lib/schedules/data";

// POST: capture an immutable baseline snapshot of the schedule's item dates.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canManageSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const baseline = await captureBaseline(id, body.name ?? "Baseline", body.reason ?? null, { id: staff.id });
    return NextResponse.json(baseline, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
