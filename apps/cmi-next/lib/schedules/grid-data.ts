// Grid edits, applied in one go (Spec R2 §4.3): cell edits, paste, fill-down,
// row moves, inserts, deletes, predecessor shorthand and Renumber by Tens.
// Loads the schedule once and recalculates once, however many cells changed.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { runCpm } from "./cpm.ts";
import { CALENDAR_DAYS, dayNum, spanW } from "./calendar.ts";
import { buildInput, blockedMove, calendarFor, wouldLoop, type NetDep } from "./engine-core.ts";
import { scheduleRows, type GridOps } from "./grid.ts";
import { ITEM_FIELDS, mapItem, logActivity, applyCascade, fieldChanges } from "./data";
import { engineModeFor, loadNetwork, recalcSchedule } from "./engine";
import { DEPENDENCY_ABBR, type ScheduleItem, type SchedulePhase } from "./types";

type Actor = { id?: string | null; name?: string | null };

export type { GridOps };

export type GridResult = {
  created: Record<string, string>;
  refused: { id: string; message: string }[];
  moved: number;
};

export async function applyGridOps(scheduleId: string, ops: GridOps, actor?: Actor): Promise<GridResult> {
  const sb = getSupabaseAdmin();
  const fail = (what: string, err: { message: string } | null | undefined) => { if (err) throw new Error(`Couldn't save the grid (${what}): ${err.message}`); };
  const { data: sched, error: e0 } = await sb.from("job_schedules").select("id, job_id").eq("id", scheduleId).maybeSingle();
  fail("schedule", e0);
  if (!sched) throw new Error("Schedule not found.");
  const engine = await engineModeFor(scheduleId);
  const now = new Date().toISOString();
  const result: GridResult = { created: {}, refused: [], moved: 0 };

  const { data: rows, error: e1 } = await sb.from("schedule_items").select("*").eq("schedule_id", scheduleId);
  fail("tasks", e1);
  const items = new Map((rows ?? []).map((r) => [r.id as string, mapItem(r)]));

  // One network + one critical-path run for every check in this batch.
  const net = engine ? await loadNetwork(scheduleId) : null;
  const cpm = net && engine === "auto" ? runCpm(buildInput(net)) : null;
  const netSched = net?.schedules.find((s) => s.id === scheduleId);
  const cal = net && netSched ? calendarFor(net, netSched) : null;

  // ---- creates ----
  if (ops.creates?.length) {
    // Rows without an ID get the next ones by tens, above every ID already
    // in the schedule or given to another row in this batch.
    const taken = [...items.values()].map((i) => i.activity_id ?? 0).concat(ops.creates.map((c) => c.row.activity_id ?? 0));
    const top = Math.floor(Math.max(0, ...taken) / 10) * 10;
    const fresh = Array.from({ length: ops.creates.length }, (_, i) => top + (i + 1) * 10);
    let k = 0;
    const used = new Set([...items.values()].map((i) => i.activity_id).filter((n): n is number => n != null));
    const insert = ops.creates.map((c) => {
      const row: Record<string, unknown> = { schedule_id: scheduleId, job_id: sched.job_id ?? null, created_by: actor?.id ?? null, updated_by: actor?.id ?? null };
      for (const f of ITEM_FIELDS) if (f in c.row) row[f] = (c.row as Record<string, unknown>)[f];
      if (!row.title) row.title = c.row.kind === "milestone" ? "New Milestone" : "New Task";
      // An ID someone else already has (e.g. picked from a stale screen) falls back to a free one.
      if (row.activity_id == null || used.has(row.activity_id as number)) row.activity_id = fresh[k++];
      used.add(row.activity_id as number);
      if (row.kind === "milestone" && row.start_date) row.end_date = row.start_date;
      return row;
    });
    const { data: made, error } = await sb.from("schedule_items").insert(insert).select("*");
    fail("new rows", error);
    (made ?? []).forEach((r, i) => { result.created[ops.creates![i].tempId] = r.id; items.set(r.id, mapItem(r)); });
  }

  // ---- updates ----
  const datesChanged: string[] = [];
  const history: { job_id: string | null; schedule_id: string; item_id: string; actor_id: string | null; action: string; detail: Record<string, unknown> }[] = [];
  for (const u of ops.updates ?? []) {
    const prev = items.get(u.id);
    if (!prev) continue;
    const clean: Record<string, unknown> = {};
    for (const f of ITEM_FIELDS) if (f in u.patch) clean[f] = (u.patch as Record<string, unknown>)[f];
    const kind = (clean.kind ?? prev.kind) as string;
    if (kind === "milestone" && clean.start_date) clean.end_date = clean.start_date;
    const startTyped = "start_date" in clean && clean.start_date && clean.start_date !== prev.start_date;
    const endTyped = "end_date" in clean && clean.end_date && clean.end_date !== prev.end_date;

    if (engine === "auto" && startTyped && !prev.is_locked && !("constraint_type" in clean) && net && cpm) {
      const blocked = blockedMove(net, u.id, clean.start_date as string, cpm);
      if (blocked) {
        const why = blocked.because.map((b) => `${b.activity_id ?? ""} ${b.title} (${DEPENDENCY_ABBR[b.type]}${b.lag ? `${b.lag > 0 ? "+" : ""}${b.lag}` : ""})`.trim()).join(", ");
        result.refused.push({ id: u.id, message: `${prev.activity_id ?? ""} ${prev.title} can't start before ${blocked.earliest}: it waits for ${why}.`.trim() });
        delete clean.start_date;
        if (kind === "milestone") delete clean.end_date;
      } else {
        clean.constraint_type = "snet";
        clean.constraint_date = clean.start_date;
      }
    }
    if (engine && kind !== "milestone" && endTyped && !("duration_days" in clean) && cal) {
      const s = (clean.start_date ?? prev.start_date) as string | null;
      const unit = (clean.duration_unit ?? prev.duration_unit) as string;
      if (s) clean.duration_days = Math.max(1, spanW(unit === "calendar" ? CALENDAR_DAYS : cal, dayNum(s), dayNum(clean.end_date as string)));
    }
    if (!Object.keys(clean).length) continue;
    const { data, error } = await sb.from("schedule_items").update({ ...clean, updated_by: actor?.id ?? null, updated_at: now }).eq("id", u.id).select("*").single();
    fail(prev.title, error);
    items.set(u.id, mapItem(data));
    if (startTyped || endTyped) datesChanged.push(u.id);
    const changes = fieldChanges(prev as unknown as Record<string, unknown>, data);
    if (Object.keys(changes).length) history.push({ job_id: sched.job_id ?? null, schedule_id: scheduleId, item_id: u.id, actor_id: actor?.id ?? null, action: ops.source === "excel" ? "item_imported" : "item_updated", detail: { title: data.title, changes, via: ops.source === "excel" ? "Excel import" : "grid" } });
  }

  if (history.length) { try { await sb.from("schedule_activity").insert(history); } catch { /* history must never block the save */ } }

  // ---- renumber by tens, in display order ----
  if (ops.renumber) {
    const { data: phases } = await sb.from("schedule_phases").select("*").eq("schedule_id", scheduleId).order("sort_order");
    const order = scheduleRows([...items.values()], (phases ?? []) as SchedulePhase[]).flatMap((r) => (r.kind === "item" ? [r.item.id] : []));
    // Two steps so no ID clashes with another row's old one on the way.
    for (const [i, id] of order.entries()) { const { error } = await sb.from("schedule_items").update({ activity_id: -(i + 1) }).eq("id", id); fail("renumber", error); }
    for (const [i, id] of order.entries()) { const { error } = await sb.from("schedule_items").update({ activity_id: (i + 1) * 10, updated_at: now }).eq("id", id); fail("renumber", error); }
  }

  // ---- deletes ----
  if (ops.deletes?.length) {
    const { error } = await sb.from("schedule_items").delete().in("id", ops.deletes).eq("schedule_id", scheduleId);
    fail("delete", error);
    for (const id of ops.deletes) items.delete(id);
  }

  // ---- predecessors ----
  if (ops.predecessors?.length) {
    const { data: depRows, error } = sched.job_id
      ? await sb.from("schedule_dependencies").select("id, source_item_id, target_item_id, dependency_type, lag_days").eq("job_id", sched.job_id)
      : await sb.from("schedule_dependencies").select("id, source_item_id, target_item_id, dependency_type, lag_days").in("target_item_id", [...items.keys()]);
    fail("links", error);
    let deps = (depRows ?? []) as (NetDep & { id: string })[];
    for (const edit of ops.predecessors) {
      const target = result.created[edit.itemId] ?? edit.itemId;
      if (!items.has(target)) continue;
      const want = edit.links.map((l) => ({ ...l, sourceItemId: result.created[l.sourceItemId] ?? l.sourceItemId })).filter((l) => items.has(l.sourceItemId));
      // Only links from this schedule are replaced; other schedules' links stay.
      const mine = deps.filter((d) => d.target_item_id === target && items.has(d.source_item_id));
      const remove = mine.filter((d) => !want.some((w) => w.sourceItemId === d.source_item_id));
      const kept = deps.filter((d) => !remove.includes(d));
      for (const w of want) {
        const exists = kept.some((d) => d.source_item_id === w.sourceItemId && d.target_item_id === target);
        if (!exists && wouldLoop(kept, w.sourceItemId, target)) {
          const t = items.get(target)!, s = items.get(w.sourceItemId)!;
          result.refused.push({ id: target, message: `Linking ${s.activity_id ?? ""} ${s.title} → ${t.activity_id ?? ""} ${t.title} would make a loop.` });
          return finish();
        }
        kept.push({ id: "", source_item_id: w.sourceItemId, target_item_id: target, dependency_type: w.type, lag_days: w.lag });
      }
      if (remove.length) { const { error: de } = await sb.from("schedule_dependencies").delete().in("id", remove.map((d) => d.id)); fail("remove links", de); }
      if (want.length) {
        const { error: ue } = await sb.from("schedule_dependencies").upsert(want.map((w) => ({
          job_id: sched.job_id ?? null, source_item_id: w.sourceItemId, target_item_id: target, dependency_type: w.type, lag_days: w.lag,
          is_cross_schedule: false, created_by: actor?.id ?? null,
        })), { onConflict: "source_item_id,target_item_id" });
        fail("links", ue);
      }
      deps = kept;
    }
  }
  return finish();

  async function finish(): Promise<GridResult> {
    if (engine) {
      result.moved = (await recalcSchedule(scheduleId, actor)).moved.length;
    } else {
      for (const id of datesChanged) result.moved += (await applyCascade(sched!.job_id, id, actor)).length;
    }
    const counts = { updated: ops.updates?.length ?? 0, created: ops.creates?.length ?? 0, deleted: ops.deletes?.length ?? 0, links: ops.predecessors?.length ?? 0, renumbered: !!ops.renumber };
    if (Object.values(counts).some(Boolean)) {
      await logActivity({
        jobId: sched!.job_id, scheduleId, action: ops.source === "excel" ? "excel_import" : "grid_edit",
        detail: { ...counts, moved: result.moved, refused: result.refused.length, ...(ops.fileName ? { file: ops.fileName.slice(0, 200) } : {}) }, actor,
      });
    }
    return result;
  }
}
