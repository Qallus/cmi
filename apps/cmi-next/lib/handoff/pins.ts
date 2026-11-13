// Pins (one home per project, Step 2): server side. Table: project_pins
// (supabase/migrations/2026-11-13_project_pins.sql). Until that migration runs,
// reads return nothing with `missing` set and the boards carry on without pins.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { liveJobOppIds } from "@/lib/pipeline/data";
import { AREA_LABEL, type Area } from "./home";
import { pinIsShown, RECORD_AREA, type PinRecordType, type PinRow } from "./pins-core";

export class PinError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));
const MISSING = "Pins aren't switched on yet: the project pins migration still needs to be run.";

/** A pinned card: enough to show it and open the real record. */
export type PinnedCard = {
  pin_id: string; record_type: PinRecordType; record_id: string;
  title: string; number: string | null; status: string | null;
  home: Area; homeLabel: string; href: string; pinned_at: string; pinned_by_name: string | null; note: string | null;
};

const ALL: PinRecordType[] = ["deal", "precon", "job"];

/** The pinned cards for one board, only those whose record is still the project's home. */
export async function pinnedForArea(area: Area): Promise<{ cards: PinnedCard[]; missing?: boolean }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("project_pins").select("id, record_type, record_id, show_in, note, pinned_at, expires_at, pinned_by").eq("show_in", area);
  if (isMissing(error)) return { cards: [], missing: true };
  if (error) throw new PinError(error.message, 500);
  const pins = (data ?? []) as (PinRow & { note: string | null; pinned_at: string; pinned_by: string | null })[];
  if (!pins.length) return { cards: [] };

  const ids = (t: PinRecordType) => pins.filter((p) => p.record_type === t).map((p) => p.record_id);
  const [deals, opps, jobs, movedOn, staff] = await Promise.all([
    ids("deal").length ? sb.from("deals").select("id, title, job_number, stage, archived_at").in("id", ids("deal")) : Promise.resolve({ data: [] }),
    ids("precon").length ? sb.from("pipeline_opportunities").select("id, opportunity_name, job_number, stage, archived_at").in("id", ids("precon")) : Promise.resolve({ data: [] }),
    ids("job").length ? sb.from("jobs").select("id, job_name, job_number, status, archived_at").in("id", ids("job")) : Promise.resolve({ data: [] }),
    ids("precon").length ? liveJobOppIds() : Promise.resolve(new Set<string>()),
    sb.from("staff_users").select("id, display_name, email").in("id", [...new Set(pins.map((p) => p.pinned_by).filter(Boolean) as string[])]),
  ]);
  const who = new Map(((staff.data ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((s) => [s.id, s.display_name || s.email]));
  type Rec = { title: string; number: string | null; status: string | null; home: boolean; href: string };
  const recs = new Map<string, Rec>();
  for (const d of (deals.data ?? []) as { id: string; title: string; job_number: string | null; stage: string; archived_at: string | null }[]) {
    recs.set(`deal:${d.id}`, { title: d.title, number: d.job_number, status: d.stage, home: !d.archived_at && d.stage !== "closed_won", href: `/dashboard/pipeline/${d.id}` });
  }
  for (const o of (opps.data ?? []) as { id: string; opportunity_name: string; job_number: string | null; stage: string; archived_at: string | null }[]) {
    recs.set(`precon:${o.id}`, { title: o.opportunity_name, number: o.job_number, status: o.stage, home: !o.archived_at && !movedOn.has(o.id), href: `/dashboard/sales/${o.id}` });
  }
  for (const j of (jobs.data ?? []) as { id: string; job_name: string; job_number: string | null; status: string; archived_at: string | null }[]) {
    recs.set(`job:${j.id}`, { title: j.job_name, number: j.job_number, status: j.status, home: !j.archived_at, href: `/dashboard/jobs/${j.id}/summary` });
  }
  const cards: PinnedCard[] = [];
  for (const p of pins) {
    const r = recs.get(`${p.record_type}:${p.record_id}`);
    if (!r || !pinIsShown(p, r.home)) continue;
    const home = RECORD_AREA[p.record_type];
    cards.push({
      pin_id: p.id, record_type: p.record_type, record_id: p.record_id, title: r.title, number: r.number, status: r.status,
      home, homeLabel: AREA_LABEL[home], href: r.href, pinned_at: p.pinned_at, pinned_by_name: p.pinned_by ? who.get(p.pinned_by) ?? null : null, note: p.note,
    });
  }
  return { cards: cards.sort((a, b) => b.pinned_at.localeCompare(a.pinned_at)) };
}

/** The boards one record is pinned to (for its "Also show in…" control). */
export async function pinsForRecord(recordType: PinRecordType, recordId: string): Promise<{ pins: { id: string; show_in: Area }[]; missing?: boolean }> {
  if (!ALL.includes(recordType)) throw new PinError("Unknown record type.");
  const { data, error } = await getSupabaseAdmin().from("project_pins").select("id, show_in").eq("record_type", recordType).eq("record_id", recordId);
  if (isMissing(error)) return { pins: [], missing: true };
  if (error) throw new PinError(error.message, 500);
  return { pins: (data ?? []) as { id: string; show_in: Area }[] };
}

export async function pinRecord(recordType: PinRecordType, recordId: string, showIn: Area, staffId: string, note?: string | null): Promise<void> {
  if (!ALL.includes(recordType)) throw new PinError("Unknown record type.");
  if (!["pipeline", "precon", "jobs"].includes(showIn)) throw new PinError("Pick Pipeline, Pre-Con or Jobs.");
  if (RECORD_AREA[recordType] === showIn) throw new PinError(`It's already in ${AREA_LABEL[showIn]}.`);
  const { error } = await getSupabaseAdmin().from("project_pins").upsert(
    { record_type: recordType, record_id: recordId, show_in: showIn, pinned_by: staffId, pinned_at: new Date().toISOString(), note: note?.slice(0, 200) || null },
    { onConflict: "record_type,record_id,show_in" },
  );
  if (isMissing(error)) throw new PinError(MISSING, 503);
  if (error) throw new PinError(error.message, 500);
}

export async function unpin(pinId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("project_pins").delete().eq("id", pinId);
  if (isMissing(error)) throw new PinError(MISSING, 503);
  if (error) throw new PinError(error.message, 500);
}
