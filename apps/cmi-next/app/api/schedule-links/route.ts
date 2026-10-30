import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { linksForRecord } from "@/lib/schedules/data";
import { LINK_TYPES } from "@/lib/schedules/links";
import { isFeatureEnabled } from "@/lib/flags";
import type { LinkType } from "@/lib/schedules/types";

// GET ?type=…&id=… — a record's own schedules, and schedule items anywhere that point at it.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled("schedule_builder"))) return NextResponse.json({ enabled: false, schedules: [], items: [] });
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as LinkType | null;
    const id = url.searchParams.get("id");
    if (!type || !id || !LINK_TYPES.includes(type)) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    return NextResponse.json({ enabled: true, ...(await linksForRecord(type, id)) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
