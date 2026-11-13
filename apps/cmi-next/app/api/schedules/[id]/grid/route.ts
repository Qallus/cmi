import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ENGINE_FLAG } from "@/lib/schedules/engine";
import { applyGridOps, renumberPreview, type GridOps } from "@/lib/schedules/grid-data";

const MAX_ROWS = 1000;

// GET ?renumber=preview: what Renumber by Tens would do (old → new for every task), nothing saved.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    if (new URL(request.url).searchParams.get("renumber") !== "preview") return NextResponse.json({ error: "Nothing to show." }, { status: 400 });
    return NextResponse.json({ changes: await renumberPreview(id) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST: a batch of grid edits (cells, paste, fill-down, row moves, inserts,
// deletes, predecessors, renumber), saved and recalculated together.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule grid is switched off." }, { status: 403 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as GridOps;
    const size = (body.updates?.length ?? 0) + (body.creates?.length ?? 0) + (body.deletes?.length ?? 0) + (body.predecessors?.length ?? 0);
    if (size > MAX_ROWS) return NextResponse.json({ error: `That's more than ${MAX_ROWS} changes at once.` }, { status: 400 });
    return NextResponse.json(await applyGridOps(id, body, { id: staff.id }));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
