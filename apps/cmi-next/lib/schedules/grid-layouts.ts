// Saved schedule grid layouts (Grid Behavior Addendum §3.3, Step D): each
// person's layouts by name (for one schedule type or every type, one of them
// their default) and the layout they last used on each schedule.
// Tables: supabase/migrations/2026-11-13_schedule_grid_layouts.sql. Until that
// migration runs, reads return nothing and `missing` is set, so the grid keeps
// working from the browser's own memory.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { configToLayout, layoutToConfig, resolveLayout, type GridLayoutConfig, type SavedGridLayout } from "./grid.ts";

const LAYOUTS = "schedule_grid_layouts";
const STATE = "schedule_grid_state";

/** The tables aren't there yet (migration not run). */
export class LayoutsMissing extends Error {
  status = 503;
  constructor() { super("Saved layouts aren't switched on yet: the schedule grid layouts migration still needs to be run."); }
}
const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));
function check(e: { code?: string; message?: string } | null | undefined) {
  if (!e) return;
  if (isMissing(e)) throw new LayoutsMissing();
  throw new Error(e.message ?? "Could not save the layout.");
}

/** Clean a layout sent from the browser: known columns, sane split, divider and zoom. */
export function cleanConfig(input: Partial<GridLayoutConfig> | null | undefined): GridLayoutConfig {
  const l = configToLayout(input);
  const name = typeof input?.layout_name === "string" ? input.layout_name.trim().slice(0, 60) || null : null;
  const divider = l.divider == null ? null : Math.min(100, Math.max(0, l.divider));
  return layoutToConfig({ name, cols: l.cols, widths: l.widths, split: l.split, divider, zoom: l.zoom });
}

type Row = Record<string, unknown>;
const toSaved = (r: Row): SavedGridLayout => ({
  id: r.id as string, name: r.name as string, schedule_type: (r.schedule_type as string | null) ?? null, is_default: !!r.is_default,
  layout_name: r.name as string, columns: (r.columns as GridLayoutConfig["columns"]) ?? [],
  split: (r.split as GridLayoutConfig["split"]) ?? "split",
  divider_pct: r.divider_pct == null ? null : Number(r.divider_pct),
  gantt_zoom: (r.gantt_zoom as GridLayoutConfig["gantt_zoom"]) ?? null,
});

async function scheduleType(scheduleId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().from("job_schedules").select("type").eq("id", scheduleId).maybeSingle();
  return (data?.type as string | null) ?? null;
}

/** Everything the grid needs when a schedule opens. */
export async function loadGridLayouts(staffUserId: string, scheduleId: string): Promise<{
  scheduleType: string | null; layouts: SavedGridLayout[]; resolved: ReturnType<typeof resolveLayout>; missing?: boolean;
}> {
  const sb = getSupabaseAdmin();
  const type = await scheduleType(scheduleId);
  const [{ data: saved, error: e1 }, { data: state, error: e2 }] = await Promise.all([
    sb.from(LAYOUTS).select("*").eq("staff_user_id", staffUserId).order("name"),
    sb.from(STATE).select("*").eq("staff_user_id", staffUserId).eq("schedule_id", scheduleId).maybeSingle(),
  ]);
  if (isMissing(e1) || isMissing(e2)) return { scheduleType: type, layouts: [], resolved: resolveLayout(null, [], type), missing: true };
  check(e1); check(e2);
  // Layouts for this schedule's type, and the ones saved for every type.
  const layouts = (saved ?? []).map(toSaved).filter((l) => l.schedule_type == null || l.schedule_type === type);
  const last = state ? ({ layout_name: state.layout_name, columns: state.columns, split: state.split, divider_pct: state.divider_pct == null ? null : Number(state.divider_pct), gantt_zoom: state.gantt_zoom } as GridLayoutConfig) : null;
  return { scheduleType: type, layouts, resolved: resolveLayout(last, layouts, type) };
}

/** Remember the layout someone is using on a schedule (called as they change it). */
export async function saveGridState(staffUserId: string, scheduleId: string, input: Partial<GridLayoutConfig>): Promise<void> {
  const c = cleanConfig(input);
  const { error } = await getSupabaseAdmin().from(STATE).upsert({
    staff_user_id: staffUserId, schedule_id: scheduleId, layout_name: c.layout_name,
    columns: c.columns, split: c.split, divider_pct: c.divider_pct, gantt_zoom: c.gantt_zoom,
  }, { onConflict: "staff_user_id,schedule_id" });
  check(error);
}

/** "Save layout as…": by name, for this schedule's type or every type. Same name
 *  and scope replaces it. `isDefault` makes it what that type opens with. */
export async function saveNamedLayout(staffUserId: string, scheduleId: string, input: {
  name: string; allTypes?: boolean; isDefault?: boolean; config: Partial<GridLayoutConfig>;
}): Promise<SavedGridLayout> {
  const sb = getSupabaseAdmin();
  const name = (input.name ?? "").trim().slice(0, 60);
  if (!name) throw Object.assign(new Error("Give the layout a name."), { status: 400 });
  const type = input.allTypes ? null : await scheduleType(scheduleId);
  const c = cleanConfig({ ...input.config, layout_name: name });
  if (input.isDefault) await clearDefault(staffUserId, type);
  // Same name in the same scope: update it.
  let q = sb.from(LAYOUTS).select("id").eq("staff_user_id", staffUserId).ilike("name", name.replace(/([%_\\])/g, "\\$1"));
  q = type == null ? q.is("schedule_type", null) : q.eq("schedule_type", type);
  const { data: same, error: e0 } = await q.maybeSingle();
  check(e0);
  const row = { staff_user_id: staffUserId, schedule_type: type, name, columns: c.columns, split: c.split, divider_pct: c.divider_pct, gantt_zoom: c.gantt_zoom, ...(input.isDefault ? { is_default: true } : {}) };
  const { data, error } = same
    ? await sb.from(LAYOUTS).update(row).eq("id", same.id).select("*").single()
    : await sb.from(LAYOUTS).insert(row).select("*").single();
  check(error);
  return toSaved(data as Row);
}

async function clearDefault(staffUserId: string, type: string | null) {
  let q = getSupabaseAdmin().from(LAYOUTS).update({ is_default: false }).eq("staff_user_id", staffUserId).eq("is_default", true);
  q = type == null ? q.is("schedule_type", null) : q.eq("schedule_type", type);
  const { error } = await q;
  check(error);
}

/** Make a saved layout the default for its type (or stop it being the default). */
export async function setLayoutDefault(staffUserId: string, layoutId: string, on: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: l, error } = await sb.from(LAYOUTS).select("id, schedule_type").eq("id", layoutId).eq("staff_user_id", staffUserId).maybeSingle();
  check(error);
  if (!l) throw Object.assign(new Error("Layout not found."), { status: 404 });
  if (on) await clearDefault(staffUserId, (l.schedule_type as string | null) ?? null);
  const { error: e2 } = await sb.from(LAYOUTS).update({ is_default: on }).eq("id", layoutId).eq("staff_user_id", staffUserId);
  check(e2);
}

export async function deleteLayout(staffUserId: string, layoutId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(LAYOUTS).delete().eq("id", layoutId).eq("staff_user_id", staffUserId);
  check(error);
}
