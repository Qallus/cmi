// Pins: also show a project on another board (one home per project, Step 2).
//   GET ?area=pipeline|precon|jobs                   the pinned cards for that board
//   GET ?record_type=deal|precon|job&record_id=      the boards one record is pinned to
//   POST { record_type, record_id, show_in, note? }  pin
//   DELETE ?id=                                      unpin
// Any signed-in CMI staff member can pin and unpin.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { pinnedForArea, pinsForRecord, pinRecord, unpin, PinError } from "@/lib/handoff/pins";
import type { Area } from "@/lib/handoff/home";
import type { PinRecordType } from "@/lib/handoff/pins-core";

const fail = (err: unknown) => {
  const e = err as (PinError | AuthError) & { status?: number };
  return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
};
const AREAS = ["pipeline", "precon", "jobs"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const sp = new URL(request.url).searchParams;
    const area = sp.get("area");
    if (area) {
      if (!AREAS.includes(area)) return NextResponse.json({ error: "Unknown board." }, { status: 400 });
      return NextResponse.json(await pinnedForArea(area as Area));
    }
    const type = sp.get("record_type"), id = sp.get("record_id");
    if (!type || !id) return NextResponse.json({ error: "Give area, or record_type and record_id." }, { status: 400 });
    return NextResponse.json(await pinsForRecord(type as PinRecordType, id));
  } catch (err) { return fail(err); }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const b = (await request.json().catch(() => ({}))) as { record_type?: PinRecordType; record_id?: string; show_in?: Area; note?: string };
    if (!b.record_type || !b.record_id || !b.show_in) return NextResponse.json({ error: "Give record_type, record_id and show_in." }, { status: 400 });
    await pinRecord(b.record_type, b.record_id, b.show_in, staff.id, b.note ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Which pin?" }, { status: 400 });
    await unpin(id);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}
