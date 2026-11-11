// Company inspection settings: who may update inspection status (read: staff; change: Super Admin).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadInspectionSettings, saveInspectionSettings, InspectionSettingsError } from "@/lib/inspections/data";
import { canEditInspectionSettings, ALWAYS_STATUS_ROLES, STATUS_ROLE_OPTIONS } from "@/lib/inspections/settings";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    return NextResponse.json({ ...(await loadInspectionSettings()), always: ALWAYS_STATUS_ROLES, options: STATUS_ROLE_OPTIONS, can_edit: canEditInspectionSettings(staff.role_slug) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditInspectionSettings(staff.role_slug)) return NextResponse.json({ error: "Only Super Admins change who updates inspection status." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { status_editor_roles?: unknown };
    return NextResponse.json(await saveInspectionSettings(body.status_editor_roles, staff.id));
  } catch (err) {
    if (err instanceof InspectionSettingsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message || "Couldn't save." }, { status: e.status ?? 500 });
  }
}
