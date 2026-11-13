import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { loadGridLayouts, saveGridState, saveNamedLayout, setLayoutDefault, deleteLayout } from "@/lib/schedules/grid-layouts";

// The signed-in person's grid layouts for this schedule (Grid Addendum §3.3).
//   GET                         what the grid opens with + their saved layouts
//   PUT    { config }           remember the layout they're using on this schedule
//   POST   { name, allTypes?, isDefault?, config }   Save layout as…
//   PATCH  { layoutId, isDefault }                   make (or unmake) a default
//   DELETE ?layoutId=                                delete a saved layout
// Layouts are personal: every query is scoped to the signed-in staff user.

type Ctx = { params: Promise<{ id: string }> };
const fail = (err: unknown) => { const e = err as AuthError & { status?: number }; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); };

async function who(request: Request) {
  const { staff } = await requireAdmin(request);
  if (!canViewSchedules(staff.role_slug)) throw Object.assign(new Error("Forbidden."), { status: 403 });
  return staff.id as string;
}

export async function GET(request: Request, { params }: Ctx) {
  try { const me = await who(request); const { id } = await params; return NextResponse.json(await loadGridLayouts(me, id)); } catch (err) { return fail(err); }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const me = await who(request); const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { config?: Record<string, unknown> };
    await saveGridState(me, id, body.config ?? {});
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const me = await who(request); const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { name?: string; allTypes?: boolean; isDefault?: boolean; config?: Record<string, unknown> };
    const layout = await saveNamedLayout(me, id, { name: body.name ?? "", allTypes: !!body.allTypes, isDefault: !!body.isDefault, config: body.config ?? {} });
    return NextResponse.json({ layout });
  } catch (err) { return fail(err); }
}

export async function PATCH(request: Request) {
  try {
    const me = await who(request);
    const body = (await request.json().catch(() => ({}))) as { layoutId?: string; isDefault?: boolean };
    if (!body.layoutId) return NextResponse.json({ error: "Which layout?" }, { status: 400 });
    await setLayoutDefault(me, body.layoutId, !!body.isDefault);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}

export async function DELETE(request: Request) {
  try {
    const me = await who(request);
    const layoutId = new URL(request.url).searchParams.get("layoutId");
    if (!layoutId) return NextResponse.json({ error: "Which layout?" }, { status: 400 });
    await deleteLayout(me, layoutId);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}
