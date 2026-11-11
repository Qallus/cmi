import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { inspectionsEnabled } from "@/lib/inspections/data";
import { applyPermit, permitPreview, permitState, type PermitApply } from "@/lib/inspections/permit-data";

const off = () => NextResponse.json({ error: "Inspection milestones are turned off." }, { status: 404 });
const fail = (err: unknown) => { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); };

/** The saved permit list, when it was verified, and the schedule's tasks. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    return NextResponse.json(await permitState(id));
  } catch (err) { return fail(err); }
}

/** { text, preview: true } compares; { text, matches, na, adds } applies. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";
    if (body.preview) return NextResponse.json(await permitPreview(id, text));
    const apply: PermitApply = {
      text,
      matches: Array.isArray(body.matches) ? body.matches.map((m: { line?: unknown; item_ids?: unknown }) => ({ line: Number(m?.line), item_ids: Array.isArray(m?.item_ids) ? m.item_ids.map(String) : [] })) : [],
      na: Array.isArray(body.na) ? body.na.map(String) : [],
      adds: Array.isArray(body.adds) ? body.adds.map((a: { line?: unknown; after_item_id?: unknown }) => ({ line: Number(a?.line), after_item_id: a?.after_item_id ? String(a.after_item_id) : null })) : [],
    };
    const result = await applyPermit(id, apply, { id: staff.id, name: staff.display_name ?? null, role: staff.role_slug ?? null });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) { return fail(err); }
}
