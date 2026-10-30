import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { searchLinkable, LINK_TYPES } from "@/lib/schedules/links";
import type { LinkType } from "@/lib/schedules/types";

// GET ?q=…&types=deal,job,… — records a schedule item (or a new schedule) can belong to or point at.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const url = new URL(request.url);
    const types = (url.searchParams.get("types") ?? "").split(",").filter((t): t is LinkType => (LINK_TYPES as string[]).includes(t));
    const hits = await searchLinkable(url.searchParams.get("q") ?? "", types.length ? types : undefined);
    return NextResponse.json({ hits });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
