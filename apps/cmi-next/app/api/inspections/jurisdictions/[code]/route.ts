// Edit one inspection jurisdiction (Super Admin / Admin): name, how to request, cutoff, active.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { saveJurisdiction, InspectionSettingsError, type JurisdictionChanges } from "@/lib/inspections/data";
import { canEditJurisdictions } from "@/lib/inspections/settings";

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditJurisdictions(staff.role_slug)) return NextResponse.json({ error: "Only Super Admins and Admins edit the jurisdiction list." }, { status: 403 });
    const { code } = await params;
    const changes = (await request.json().catch(() => ({}))) as JurisdictionChanges;
    return NextResponse.json({ jurisdiction: await saveJurisdiction(code, changes, staff.id) });
  } catch (err) {
    if (err instanceof InspectionSettingsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message || "Couldn't save the jurisdiction." }, { status: e.status ?? 500 });
  }
}
