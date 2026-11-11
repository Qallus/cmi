// Inspection jurisdictions: the list (staff) and adding one (Super Admin / Admin).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJurisdictions, saveJurisdiction, InspectionSettingsError, type JurisdictionChanges } from "@/lib/inspections/data";
import { canEditJurisdictions } from "@/lib/inspections/settings";

function fail(err: unknown) {
  if (err instanceof InspectionSettingsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const e = err as AuthError;
  return NextResponse.json({ error: e.message || "Something went wrong." }, { status: e.status ?? 500 });
}

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const all = new URL(request.url).searchParams.get("all") === "1";
    return NextResponse.json({ jurisdictions: await loadJurisdictions({ includeInactive: all }), can_edit: canEditJurisdictions(staff.role_slug) });
  } catch (err) { return fail(err); }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditJurisdictions(staff.role_slug)) return NextResponse.json({ error: "Only Super Admins and Admins edit the jurisdiction list." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as JurisdictionChanges & { code?: string };
    const { code, ...changes } = body;
    return NextResponse.json({ jurisdiction: await saveJurisdiction(code ?? "", changes, staff.id, { create: true }) }, { status: 201 });
  } catch (err) { return fail(err); }
}
