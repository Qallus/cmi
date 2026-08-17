import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { getItem, computeCascade } from "@/lib/schedules/data";

// GET: Schedule Impact Preview — the downstream items that would shift if this
// item moved, without applying the changes.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const item = await getItem(id);
    if (!item?.job_id) return NextResponse.json({ changes: [] });
    const changes = await computeCascade(item.job_id, id);
    return NextResponse.json({ changes });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
