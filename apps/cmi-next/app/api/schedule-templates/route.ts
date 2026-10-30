import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { SCHEDULE_TEMPLATES, SCHEDULE_PACKAGES, templateSummary } from "@/lib/schedules/templates";

// Built-in schedule templates + job packages (for the wizard + package picker).
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json({
      templates: SCHEDULE_TEMPLATES.map(templateSummary),
      packages: SCHEDULE_PACKAGES,
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
