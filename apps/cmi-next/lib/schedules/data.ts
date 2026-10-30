// CMI Multi-Schedule Builder — repository. All access is server-side via the
// service-role client (RLS bypass); the API layer gates by role.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addWorkdays, parseISO, fmtISO, workdaysBetween, workdayDiff } from "./workdays";
import { notifyScheduleEvent, assigneeStaffIds } from "./notify";
import { DEFAULT_WORKDAYS } from "./types";
import type {
  JobSchedule, SchedulePhase, ScheduleItem, ScheduleDependency, ScheduleParticipant,
  ScheduleBaseline, ScheduleActivity, ScheduleDraft, Workdays, DependencyType, Assignee,
} from "./types";

type Actor = { id?: string | null; name?: string | null };

// ---- staff name resolution ----
async function staffNames(): Promise<Map<string, string>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("staff_users").select("id, display_name, email");
  const m = new Map<string, string>();
  for (const s of data ?? []) m.set(s.id, s.display_name || s.email || "Staff");
  return m;
}

// ---- row mappers ----
function mapSchedule(r: any, names?: Map<string, string>): JobSchedule {
  return {
    ...r,
    workdays: (r.workdays ?? DEFAULT_WORKDAYS) as Workdays,
    owner_name: r.owner_id ? names?.get(r.owner_id) ?? null : null,
    manager_name: r.manager_id ? names?.get(r.manager_id) ?? null : null,
  } as JobSchedule;
}
function mapItem(r: any): ScheduleItem {
  return {
    ...r,
    assignees: (r.assignees ?? []) as Assignee[],
    tags: (r.tags ?? []) as string[],
    relationships: (r.relationships ?? {}) as Record<string, unknown>,
  } as ScheduleItem;
}

// ---- activity ----
export async function logActivity(input: {
  jobId?: string | null; scheduleId?: string | null; itemId?: string | null;
  action: string; detail?: Record<string, unknown>; actor?: Actor;
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("schedule_activity").insert({
      job_id: input.jobId ?? null, schedule_id: input.scheduleId ?? null, item_id: input.itemId ?? null,
      actor_id: input.actor?.id ?? null, actor_name: input.actor?.name ?? null,
      action: input.action, detail: input.detail ?? {},
    });
  } catch { /* activity logging must never block the operation */ }
}

export async function listActivity(opts: { jobId?: string; scheduleId?: string; limit?: number }): Promise<ScheduleActivity[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("schedule_activity").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.scheduleId) q = q.eq("schedule_id", opts.scheduleId);
  else if (opts.jobId) q = q.eq("job_id", opts.jobId);
  const { data } = await q;
  return (data ?? []) as ScheduleActivity[];
}

// ---- schedules ----
export async function listSchedules(jobId: string, opts: { includeArchived?: boolean } = {}): Promise<JobSchedule[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("job_schedules").select("*").eq("job_id", jobId).order("is_master", { ascending: false }).order("sort_order").order("created_at");
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const [{ data: rows }, names] = await Promise.all([q, staffNames()]);
  return withCounts((rows ?? []).map((r) => mapSchedule(r, names)));
}

// Task / milestone / overdue counts for a set of schedules.
async function withCounts<T extends JobSchedule>(schedules: T[]): Promise<T[]> {
  const ids = schedules.map((s) => s.id);
  if (!ids.length) return schedules;
  const sb = getSupabaseAdmin();
  const { data: items } = await sb.from("schedule_items").select("schedule_id, kind, status, end_date").in("schedule_id", ids).limit(20000);
  const today = fmtISO(new Date());
  for (const s of schedules) {
    const its = (items ?? []).filter((i) => i.schedule_id === s.id);
    s.item_count = its.filter((i) => i.kind === "task").length;
    s.milestone_count = its.filter((i) => i.kind === "milestone").length;
    s.overdue_count = its.filter((i) => i.status !== "complete" && i.status !== "cancelled" && i.end_date && i.end_date < today).length;
  }
  return schedules;
}

export async function getSchedule(id: string): Promise<JobSchedule | null> {
  const sb = getSupabaseAdmin();
  const [{ data }, names] = await Promise.all([sb.from("job_schedules").select("*").eq("id", id).maybeSingle(), staffNames()]);
  return data ? mapSchedule(data, names) : null;
}

export async function createSchedule(jobId: string, draft: ScheduleDraft, actor?: Actor): Promise<JobSchedule> {
  const sb = getSupabaseAdmin();
  if (draft.is_master) {
    await sb.from("job_schedules").update({ is_master: false }).eq("job_id", jobId).eq("is_master", true);
  }
  const { data, error } = await sb.from("job_schedules").insert({
    job_id: jobId,
    name: draft.name?.trim() || "Untitled Schedule",
    type: draft.type ?? "construction",
    description: draft.description ?? null,
    owner_id: draft.owner_id ?? null,
    manager_id: draft.manager_id ?? null,
    start_date: draft.start_date ?? null,
    target_completion: draft.target_completion ?? null,
    status: draft.status ?? "active",
    priority: draft.priority ?? "normal",
    is_master: draft.is_master ?? false,
    visibility: draft.visibility ?? "internal",
    workdays: draft.workdays ?? DEFAULT_WORKDAYS,
    color: draft.color ?? null,
    created_by: actor?.id ?? null,
    updated_by: actor?.id ?? null,
  }).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ jobId, scheduleId: data.id, action: "schedule_created", detail: { name: data.name, type: data.type }, actor });
  return mapSchedule(data);
}

export async function updateSchedule(id: string, patch: Partial<ScheduleDraft> & { progress?: number; health?: string; status?: string }, actor?: Actor): Promise<JobSchedule> {
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from("job_schedules").select("job_id, is_master").eq("id", id).maybeSingle();
  if (patch.is_master && cur?.job_id) {
    await sb.from("job_schedules").update({ is_master: false }).eq("job_id", cur.job_id).eq("is_master", true).neq("id", id);
  }
  const clean: Record<string, unknown> = { updated_by: actor?.id ?? null, updated_at: new Date().toISOString() };
  for (const k of ["name", "type", "description", "owner_id", "manager_id", "start_date", "target_completion", "projected_completion", "status", "priority", "progress", "health", "is_master", "visibility", "workdays", "color", "sort_order"] as const) {
    if (k in patch) clean[k] = (patch as Record<string, unknown>)[k];
  }
  if (patch.status === "archived") clean.archived_at = new Date().toISOString();
  const { data, error } = await sb.from("job_schedules").update(clean).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ jobId: data.job_id, scheduleId: id, action: "schedule_updated", detail: { fields: Object.keys(clean) }, actor });
  return mapSchedule(data);
}

export async function archiveSchedule(id: string, actor?: Actor): Promise<void> {
  await updateSchedule(id, { status: "archived" }, actor);
}
export async function deleteSchedule(id: string, actor?: Actor): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("job_schedules").select("job_id, name").eq("id", id).maybeSingle();
  await sb.from("job_schedules").delete().eq("id", id);
  await logActivity({ jobId: data?.job_id ?? null, action: "schedule_deleted", detail: { name: data?.name }, actor });
}

// ---- phases ----
export async function listPhases(scheduleId: string): Promise<SchedulePhase[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_phases").select("*").eq("schedule_id", scheduleId).order("sort_order").order("created_at");
  return (data ?? []) as SchedulePhase[];
}
export async function createPhase(scheduleId: string, input: Partial<SchedulePhase>, actor?: Actor): Promise<SchedulePhase> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("schedule_phases").insert({ schedule_id: scheduleId, name: input.name?.trim() || "New Phase", owner_id: input.owner_id ?? null, start_date: input.start_date ?? null, end_date: input.end_date ?? null, color: input.color ?? null, sort_order: input.sort_order ?? 0 }).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ scheduleId, action: "phase_created", detail: { name: data.name }, actor });
  return data as SchedulePhase;
}
export async function updatePhase(id: string, patch: Partial<SchedulePhase>): Promise<SchedulePhase> {
  const sb = getSupabaseAdmin();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "owner_id", "start_date", "end_date", "status", "progress", "visibility", "health", "color", "collapsed", "sort_order"] as const) {
    if (k in patch) clean[k] = (patch as Record<string, unknown>)[k];
  }
  const { data, error } = await sb.from("schedule_phases").update(clean).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as SchedulePhase;
}
export async function deletePhase(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("schedule_phases").delete().eq("id", id);
}

// ---- items ----
const ITEM_FIELDS = [
  "phase_id", "kind", "title", "description", "status", "priority", "start_date", "end_date",
  "start_time", "end_time", "all_day", "duration_days", "percent_complete", "assignees",
  "responsible_company", "client_visible", "confirmation_required", "tags", "location",
  "internal_notes", "client_notes", "is_critical", "is_locked", "baseline_start", "baseline_end",
  "recurrence", "relationships", "milestone_kind", "master_display", "sort_order",
] as const;

export async function listItems(opts: { scheduleId?: string; scheduleIds?: string[]; jobId?: string; clientVisibleOnly?: boolean }): Promise<ScheduleItem[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("schedule_items").select("*").order("sort_order").order("start_date", { ascending: true, nullsFirst: false }).order("created_at");
  if (opts.scheduleId) q = q.eq("schedule_id", opts.scheduleId);
  else if (opts.scheduleIds?.length) q = q.in("schedule_id", opts.scheduleIds);
  else if (opts.jobId) q = q.eq("job_id", opts.jobId);
  if (opts.clientVisibleOnly) q = q.eq("client_visible", true);
  const { data } = await q;
  const items = (data ?? []).map(mapItem);
  // Decorate with schedule name/type/color for overlay views.
  const schedIds = Array.from(new Set(items.map((i) => i.schedule_id)));
  if (schedIds.length) {
    const { data: scheds } = await sb.from("job_schedules").select("id, name, type, color").in("id", schedIds);
    const map = new Map((scheds ?? []).map((s) => [s.id, s]));
    for (const i of items) {
      const s = map.get(i.schedule_id);
      if (s) { i.schedule_name = s.name; i.schedule_type = s.type; i.schedule_color = s.color; }
    }
  }
  return items;
}

export async function getItem(id: string): Promise<ScheduleItem | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_items").select("*").eq("id", id).maybeSingle();
  return data ? mapItem(data) : null;
}

export async function createItem(scheduleId: string, input: Partial<ScheduleItem>, actor?: Actor): Promise<ScheduleItem> {
  const sb = getSupabaseAdmin();
  const { data: sched } = await sb.from("job_schedules").select("job_id").eq("id", scheduleId).maybeSingle();
  const row: Record<string, unknown> = { schedule_id: scheduleId, job_id: sched?.job_id ?? null, created_by: actor?.id ?? null, updated_by: actor?.id ?? null };
  for (const k of ITEM_FIELDS) if (k in input) row[k] = (input as Record<string, unknown>)[k];
  if (!row.title) row.title = input.kind === "milestone" ? "New Milestone" : "New Item";
  const { data, error } = await sb.from("schedule_items").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ jobId: sched?.job_id ?? null, scheduleId, itemId: data.id, action: "item_created", detail: { title: data.title, kind: data.kind }, actor });
  const created = mapItem(data);
  const assignees = assigneeStaffIds(created.assignees);
  if (assignees.length) {
    await notifyScheduleEvent({ kind: "assigned", recipientIds: assignees, jobId: data.job_id, scheduleId, itemId: data.id, title: `Assigned: ${data.title}`, subtitle: created.end_date ? `Due ${created.end_date}` : "New schedule assignment", actorId: actor?.id });
  }
  return created;
}

export async function updateItem(id: string, patch: Partial<ScheduleItem>, actor?: Actor, opts: { cascade?: boolean } = {}): Promise<{ item: ScheduleItem; cascaded: ScheduleItem[] }> {
  const sb = getSupabaseAdmin();
  const { data: prev } = await sb.from("schedule_items").select("*").eq("id", id).maybeSingle();
  const clean: Record<string, unknown> = { updated_by: actor?.id ?? null, updated_at: new Date().toISOString() };
  for (const k of ITEM_FIELDS) if (k in patch) clean[k] = (patch as Record<string, unknown>)[k];
  const { data, error } = await sb.from("schedule_items").update(clean).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ jobId: data.job_id, scheduleId: data.schedule_id, itemId: id, action: "item_updated", detail: { fields: Object.keys(clean), title: data.title }, actor });

  // Notify newly-added assignees, and (on a date change) the existing assignees.
  const prevAssignees = assigneeStaffIds((prev?.assignees ?? []) as never);
  const nowAssignees = assigneeStaffIds(mapItem(data).assignees);
  const added = nowAssignees.filter((x) => !prevAssignees.includes(x));
  const datesChanged = prev && (prev.start_date !== data.start_date || prev.end_date !== data.end_date);
  if (added.length) {
    await notifyScheduleEvent({ kind: "assigned", recipientIds: added, jobId: data.job_id, scheduleId: data.schedule_id, itemId: id, title: `Assigned: ${data.title}`, subtitle: data.end_date ? `Due ${data.end_date}` : "New schedule assignment", actorId: actor?.id });
  }
  if (datesChanged) {
    const movedRecipients = nowAssignees.filter((x) => !added.includes(x));
    if (movedRecipients.length) await notifyScheduleEvent({ kind: "moved", recipientIds: movedRecipients, jobId: data.job_id, scheduleId: data.schedule_id, itemId: id, title: `Rescheduled: ${data.title}`, subtitle: `Now ${data.start_date ?? "?"}${data.end_date ? ` → ${data.end_date}` : ""}`, actorId: actor?.id });
  }

  let cascaded: ScheduleItem[] = [];
  if (opts.cascade !== false && datesChanged && data.job_id) {
    cascaded = await applyCascade(data.job_id, id, actor);
  }
  return { item: mapItem(data), cascaded };
}

export async function deleteItem(id: string, actor?: Actor): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_items").select("job_id, schedule_id, title").eq("id", id).maybeSingle();
  await sb.from("schedule_items").delete().eq("id", id);
  await logActivity({ jobId: data?.job_id ?? null, scheduleId: data?.schedule_id ?? null, action: "item_deleted", detail: { title: data?.title }, actor });
}

// Reorder / move helper for kanban & drag operations.
export async function bulkUpdateItems(updates: { id: string; patch: Partial<ScheduleItem> }[]): Promise<void> {
  const sb = getSupabaseAdmin();
  await Promise.all(updates.map((u) => {
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ITEM_FIELDS) if (k in u.patch) clean[k] = (u.patch as Record<string, unknown>)[k];
    return sb.from("schedule_items").update(clean).eq("id", u.id);
  }));
}

// ---- dependencies + cascade ----
export async function listDependencies(opts: { jobId?: string; scheduleId?: string }): Promise<ScheduleDependency[]> {
  const sb = getSupabaseAdmin();
  if (opts.scheduleId) {
    // deps where either endpoint belongs to this schedule
    const { data: items } = await sb.from("schedule_items").select("id").eq("schedule_id", opts.scheduleId);
    const ids = (items ?? []).map((i) => i.id);
    if (!ids.length) return [];
    const { data } = await sb.from("schedule_dependencies").select("*").or(`source_item_id.in.(${ids.join(",")}),target_item_id.in.(${ids.join(",")})`);
    return (data ?? []) as ScheduleDependency[];
  }
  let q = sb.from("schedule_dependencies").select("*");
  if (opts.jobId) q = q.eq("job_id", opts.jobId);
  const { data } = await q;
  return (data ?? []) as ScheduleDependency[];
}

export async function createDependency(input: { jobId?: string | null; sourceItemId: string; targetItemId: string; type?: DependencyType; lagDays?: number; notes?: string | null }, actor?: Actor): Promise<ScheduleDependency> {
  const sb = getSupabaseAdmin();
  // Cross-schedule flag = source and target in different schedules.
  const { data: pair } = await sb.from("schedule_items").select("id, schedule_id, job_id").in("id", [input.sourceItemId, input.targetItemId]);
  const src = (pair ?? []).find((p) => p.id === input.sourceItemId);
  const tgt = (pair ?? []).find((p) => p.id === input.targetItemId);
  const isCross = !!src && !!tgt && src.schedule_id !== tgt.schedule_id;
  const jobId = input.jobId ?? src?.job_id ?? tgt?.job_id ?? null;
  const { data, error } = await sb.from("schedule_dependencies").upsert({
    job_id: jobId, source_item_id: input.sourceItemId, target_item_id: input.targetItemId,
    dependency_type: input.type ?? "finish_to_start", lag_days: input.lagDays ?? 0,
    is_cross_schedule: isCross, notes: input.notes ?? null, created_by: actor?.id ?? null,
  }, { onConflict: "source_item_id,target_item_id" }).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ jobId, action: isCross ? "cross_schedule_dependency_added" : "dependency_added", detail: { type: data.dependency_type }, actor });
  return data as ScheduleDependency;
}

export async function deleteDependency(id: string, actor?: Actor): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_dependencies").select("job_id").eq("id", id).maybeSingle();
  await sb.from("schedule_dependencies").delete().eq("id", id);
  await logActivity({ jobId: data?.job_id ?? null, action: "dependency_removed", actor });
}

type CascadeChange = { item: ScheduleItem; from: { start: string | null; end: string | null }; to: { start: string | null; end: string | null } };

/** Compute (without persisting) the downstream date changes if `changedItemId`
 *  moved. Respects dependency type, lag, per-schedule workdays, and locks. */
export async function computeCascade(jobId: string, changedItemId: string): Promise<CascadeChange[]> {
  const sb = getSupabaseAdmin();
  const [{ data: itemRows }, { data: deps }, { data: scheds }] = await Promise.all([
    sb.from("schedule_items").select("*").eq("job_id", jobId),
    sb.from("schedule_dependencies").select("*").eq("job_id", jobId),
    sb.from("job_schedules").select("id, workdays").eq("job_id", jobId),
  ]);
  const items = new Map<string, any>((itemRows ?? []).map((i) => [i.id, { ...i }]));
  const wdBySched = new Map<string, Workdays>((scheds ?? []).map((s) => [s.id, (s.workdays ?? DEFAULT_WORKDAYS) as Workdays]));
  const bySource = new Map<string, any[]>();
  for (const d of deps ?? []) { const a = bySource.get(d.source_item_id) ?? []; a.push(d); bySource.set(d.source_item_id, a); }

  const changes: CascadeChange[] = [];
  const queue: string[] = [changedItemId];
  const seen = new Set<string>();
  let guard = 0;
  while (queue.length && guard++ < 5000) {
    const srcId = queue.shift()!;
    const src = items.get(srcId);
    if (!src) continue;
    for (const dep of bySource.get(srcId) ?? []) {
      const tgt = items.get(dep.target_item_id);
      if (!tgt || tgt.is_locked || dep.auto_cascade === false) continue;
      const wd = wdBySched.get(tgt.schedule_id) ?? DEFAULT_WORKDAYS;
      const srcStart = parseISO(src.start_date), srcEnd = parseISO(src.end_date);
      const tgtStart = parseISO(tgt.start_date), tgtEnd = parseISO(tgt.end_date);
      if (!srcStart || !srcEnd || !tgtStart || !tgtEnd) continue;
      const dur = Math.max(1, workdaysBetween(tgtStart, tgtEnd, wd)); // working days, the unit the cascade moves in
      let newStart = tgtStart;
      const lag = dep.lag_days ?? 0;
      if (dep.dependency_type === "finish_to_start") newStart = addWorkdays(srcEnd, 1 + lag, wd);
      else if (dep.dependency_type === "start_to_start") newStart = addWorkdays(srcStart, lag, wd);
      else if (dep.dependency_type === "finish_to_finish") { const ne = addWorkdays(srcEnd, lag, wd); newStart = addWorkdays(ne, -(dur - 1), wd); }
      else if (dep.dependency_type === "start_to_finish") { const ne = addWorkdays(srcStart, lag, wd); newStart = addWorkdays(ne, -(dur - 1), wd); }
      // Only shift forward (never pull a successor earlier than planned).
      if (newStart <= tgtStart) continue;
      const newEnd = addWorkdays(newStart, Math.max(0, dur - 1), wd);
      const from = { start: tgt.start_date, end: tgt.end_date };
      tgt.start_date = fmtISO(newStart); tgt.end_date = fmtISO(newEnd);
      changes.push({ item: mapItem(tgt), from, to: { start: tgt.start_date, end: tgt.end_date } });
      if (!seen.has(tgt.id)) { seen.add(tgt.id); queue.push(tgt.id); }
    }
  }
  return changes;
}

export async function applyCascade(jobId: string, changedItemId: string, actor?: Actor): Promise<ScheduleItem[]> {
  const changes = await computeCascade(jobId, changedItemId);
  if (!changes.length) return [];
  const sb = getSupabaseAdmin();
  await Promise.all(changes.map((c) => sb.from("schedule_items").update({ start_date: c.to.start, end_date: c.to.end, updated_at: new Date().toISOString() }).eq("id", c.item.id)));
  await logActivity({ jobId, action: "cascade_applied", detail: { count: changes.length, from_item: changedItemId }, actor });
  // Notify assignees of items that shifted from the cascade.
  for (const c of changes) {
    const recipients = assigneeStaffIds(c.item.assignees);
    if (recipients.length) await notifyScheduleEvent({ kind: "moved", recipientIds: recipients, jobId, scheduleId: c.item.schedule_id, itemId: c.item.id, title: `Rescheduled: ${c.item.title}`, subtitle: `Now ${c.to.start ?? "?"}${c.to.end ? ` → ${c.to.end}` : ""} (dependency)`, actorId: actor?.id });
  }
  return changes.map((c) => c.item);
}

// ---- templates + packages ----
function addCalDays(iso: string, n: number): string {
  const d = parseISO(iso) ?? new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return fmtISO(d);
}

export type ApplyTemplateOptions = {
  /** First day of the schedule (YYYY-MM-DD); every task keeps its spacing from it. Defaults to the schedule's start date, else today. */
  startDate?: string | null;
  /** true (default): moving a task moves the tasks linked after it. false: links are kept for reference and the PM moves dates by hand. */
  autoCascade?: boolean;
};
export type ApplyTemplateResult = { items: number; start: string; finish: string; assigned: string[]; unmatched_assignees: string[] };

const phaseRange = (rows: { start_date: string | null; end_date: string | null }[]) => {
  const dated = rows.filter((r) => r.start_date);
  if (!dated.length) return null;
  return {
    start_date: dated.reduce((m, r) => (r.start_date! < m ? r.start_date! : m), dated[0].start_date!),
    end_date: dated.reduce((m, r) => ((r.end_date ?? r.start_date!) > m ? (r.end_date ?? r.start_date!) : m), dated[0].end_date ?? dated[0].start_date!),
  };
};

/** Seed a schedule's phases, items, and dependencies from a built-in template. */
export async function applyTemplate(scheduleId: string, templateId: string, actor?: Actor, opts: ApplyTemplateOptions = {}): Promise<ApplyTemplateResult> {
  const { getTemplate } = await import("./templates");
  const tpl = getTemplate(templateId);
  if (!tpl) throw new Error("Unknown template.");
  const sb = getSupabaseAdmin();
  const { data: sched } = await sb.from("job_schedules").select("id, job_id, start_date, target_completion, workdays").eq("id", scheduleId).maybeSingle();
  if (!sched) throw new Error("Schedule not found.");
  const wd = (sched.workdays ?? DEFAULT_WORKDAYS) as Workdays;
  const byWorkdays = tpl.unit === "workdays";
  const requested = opts.startDate && parseISO(opts.startDate) ? opts.startDate : null;
  let base: string = requested || sched.start_date || fmtISO(new Date());
  if (byWorkdays) base = fmtISO(addWorkdays(parseISO(base)!, 0, wd)); // a weekend start moves to the next workday

  // Template assignees are staff names; match them to staff accounts.
  const names = Array.from(new Set(tpl.items.flatMap((i) => i.assignees ?? [])));
  const staffByName = new Map<string, { id: string; name: string }>();
  if (names.length) {
    const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
    const { data: staff } = await sb.from("staff_users").select("id, display_name");
    const all = new Map<string, { id: string; name: string }>();
    for (const p of staff ?? []) if (p.display_name) all.set(norm(p.display_name), { id: p.id, name: p.display_name });
    // Exact name first, then same last name and first initial ("Joe Ballard" → "Joseph Ballard") when only one person fits.
    const parts = (v: string) => { const w = norm(v).split(" "); return { first: w[0], last: w[w.length - 1] }; };
    for (const n of names) {
      const hit = all.get(norm(n));
      if (hit) { staffByName.set(n, hit); continue; }
      const want = parts(n);
      const close = Array.from(all.entries()).filter(([k]) => { const p = parts(k); return p.last === want.last && p.first[0] === want.first[0]; });
      if (close.length === 1) staffByName.set(n, close[0][1]);
    }
  }

  const { count: phaseCount } = await sb.from("schedule_phases").select("id", { count: "exact", head: true }).eq("schedule_id", scheduleId);
  const firstPhase = phaseCount ?? 0;
  const { data: phaseRows, error: phaseErr } = await sb.from("schedule_phases")
    .insert(tpl.phases.map((ph, i) => ({ schedule_id: scheduleId, name: ph.name, sort_order: firstPhase + i })))
    .select("id, sort_order");
  if (phaseErr) throw new Error(phaseErr.message);
  const phaseIdByKey = new Map<string, string>();
  for (const r of phaseRows ?? []) phaseIdByKey.set(tpl.phases[r.sort_order - firstPhase].key, r.id);

  const { count: itemCount } = await sb.from("schedule_items").select("id", { count: "exact", head: true }).eq("schedule_id", scheduleId);
  const firstSort = itemCount ?? 0;
  const rows = tpl.items.map((it, i) => {
    const days = it.kind === "milestone" ? 1 : Math.max(1, it.duration ?? 1);
    const start = byWorkdays ? fmtISO(addWorkdays(parseISO(base)!, it.offset, wd)) : addCalDays(base, it.offset);
    const end = byWorkdays ? fmtISO(addWorkdays(parseISO(start)!, days - 1, wd)) : addCalDays(start, days - 1);
    const people = (it.assignees ?? []).flatMap((n) => staffByName.get(n) ?? []);
    return {
      schedule_id: scheduleId, job_id: sched.job_id ?? null, phase_id: it.phaseKey ? phaseIdByKey.get(it.phaseKey) ?? null : null,
      kind: it.kind ?? "task", title: it.title, start_date: start, end_date: end, duration_days: it.kind === "milestone" ? null : it.duration ?? null,
      assignees: people.map((p) => ({ id: p.id, name: p.name, type: "staff" })),
      sort_order: firstSort + i, created_by: actor?.id ?? null, updated_by: actor?.id ?? null,
    };
  });
  const { data: itemRows, error: itemErr } = await sb.from("schedule_items").insert(rows).select("id, sort_order");
  if (itemErr) throw new Error(itemErr.message);
  const itemIdByKey = new Map<string, string>();
  for (const r of itemRows ?? []) itemIdByKey.set(tpl.items[r.sort_order - firstSort].key, r.id);

  const deps = tpl.items.flatMap((it) => (it.deps ?? []).flatMap((dep) => {
    const src = itemIdByKey.get(dep.on), tgt = itemIdByKey.get(it.key);
    return src && tgt ? [{
      job_id: sched.job_id ?? null, source_item_id: src, target_item_id: tgt, dependency_type: dep.type ?? "finish_to_start",
      lag_days: dep.lag ?? 0, auto_cascade: opts.autoCascade !== false, created_by: actor?.id ?? null,
    }] : [];
  }));
  if (deps.length) { const { error } = await sb.from("schedule_dependencies").insert(deps); if (error) throw new Error(error.message); }

  // Phase date ranges, and the schedule's own dates when they're blank or a start was picked.
  const finish = rows.reduce((m, r) => (r.end_date > m ? r.end_date : m), base);
  await Promise.all(Array.from(phaseIdByKey.values()).map((pid) => {
    const range = phaseRange(rows.filter((r) => r.phase_id === pid));
    return range ? sb.from("schedule_phases").update(range).eq("id", pid) : null;
  }));
  const schedPatch: Record<string, unknown> = {};
  if (requested || !sched.start_date) schedPatch.start_date = base;
  if (requested || !sched.target_completion) schedPatch.target_completion = finish;
  if (Object.keys(schedPatch).length) await sb.from("job_schedules").update(schedPatch).eq("id", scheduleId);

  // One notification per assigned person, not one per task.
  const assignedIds = Array.from(new Set(rows.flatMap((r) => r.assignees.map((a) => a.id))));
  const firstItem = itemRows?.find((r) => r.sort_order === firstSort);
  if (assignedIds.length && firstItem) {
    await notifyScheduleEvent({ kind: "assigned", recipientIds: assignedIds, jobId: sched.job_id ?? null, scheduleId, itemId: firstItem.id, title: `Assigned on the ${tpl.name} schedule`, subtitle: `Schedule starts ${base}`, actorId: actor?.id });
  }
  await logActivity({ jobId: sched.job_id ?? null, scheduleId, action: "template_applied", detail: { template: templateId, items: rows.length, start: base, finish, auto_cascade: opts.autoCascade !== false }, actor });
  return { items: rows.length, start: base, finish, assigned: Array.from(staffByName.keys()), unmatched_assignees: names.filter((n) => !staffByName.has(n)) };
}

/** Apply a Job Schedule Package: create each template as its own schedule. */
export async function applyPackage(jobId: string, packageId: string, actor?: Actor, opts: ApplyTemplateOptions = {}): Promise<JobSchedule[]> {
  const { getPackage, getTemplate } = await import("./templates");
  const pkg = getPackage(packageId);
  if (!pkg) throw new Error("Unknown package.");
  const created: JobSchedule[] = [];
  for (const tid of pkg.templateIds) {
    const tpl = getTemplate(tid); if (!tpl) continue;
    const schedule = await createSchedule(jobId, { name: tpl.name, type: tpl.type, description: tpl.description, is_master: tid === "construction", start_date: opts.startDate || null }, actor);
    await applyTemplate(schedule.id, tid, actor, opts);
    created.push(schedule);
  }
  await logActivity({ jobId, action: "package_applied", detail: { package: packageId, schedules: created.length }, actor });
  return created;
}

export type ShiftResult = {
  from: string | null; to: string; workdays: number; moved: number; finish: string | null;
  skipped: { id: string; title: string; reason: "locked" | "complete" }[];
  changes: { id: string; title: string; from: { start: string | null; end: string | null }; to: { start: string; end: string } }[];
};

/** Move a whole schedule so it starts on `newStart`: every task moves by the same
 *  number of working days and keeps its length. Locked tasks stay put, and so do
 *  complete/cancelled ones unless includeComplete. dryRun returns the plan only. */
export async function shiftSchedule(scheduleId: string, newStart: string, actor?: Actor, opts: { includeComplete?: boolean; dryRun?: boolean } = {}): Promise<ShiftResult> {
  const sb = getSupabaseAdmin();
  const target = parseISO(newStart);
  if (!target) throw new Error("Pick a valid start date (YYYY-MM-DD).");
  const { data: sched } = await sb.from("job_schedules").select("id, job_id, name, start_date, target_completion, workdays").eq("id", scheduleId).maybeSingle();
  if (!sched) throw new Error("Schedule not found.");
  const wd = (sched.workdays ?? DEFAULT_WORKDAYS) as Workdays;
  const items = (await listItems({ scheduleId })).filter((i) => i.start_date);
  const anchor = items.reduce<string | null>((m, i) => (!m || i.start_date! < m ? i.start_date! : m), null) ?? sched.start_date;
  const to = fmtISO(addWorkdays(target, 0, wd));
  const result: ShiftResult = { from: anchor, to, workdays: 0, moved: 0, finish: null, skipped: [], changes: [] };
  if (!anchor) return result;
  const delta = workdayDiff(addWorkdays(parseISO(anchor)!, 0, wd), parseISO(to)!, wd);
  result.workdays = delta;

  for (const i of items) {
    if (i.is_locked) { result.skipped.push({ id: i.id, title: i.title, reason: "locked" }); continue; }
    if (!opts.includeComplete && (i.status === "complete" || i.status === "cancelled")) { result.skipped.push({ id: i.id, title: i.title, reason: "complete" }); continue; }
    if (!delta) continue;
    const s0 = parseISO(i.start_date)!, e0 = parseISO(i.end_date) ?? s0;
    const start = addWorkdays(s0, delta, wd);
    const end = i.kind === "milestone" ? start : addWorkdays(start, Math.max(1, workdaysBetween(s0, e0, wd)) - 1, wd);
    result.changes.push({ id: i.id, title: i.title, from: { start: i.start_date, end: i.end_date }, to: { start: fmtISO(start), end: fmtISO(end) } });
  }
  result.moved = result.changes.length;
  const moved = new Map(result.changes.map((c) => [c.id, c]));
  const after = items.map((i) => ({ ...i, start_date: moved.get(i.id)?.to.start ?? i.start_date, end_date: moved.get(i.id)?.to.end ?? i.end_date }));
  result.finish = phaseRange(after)?.end_date ?? null;
  if (opts.dryRun || !result.moved) return result;

  const now = new Date().toISOString();
  await Promise.all(result.changes.map((c) => sb.from("schedule_items").update({ start_date: c.to.start, end_date: c.to.end, updated_at: now, updated_by: actor?.id ?? null }).eq("id", c.id)));
  const { data: phases } = await sb.from("schedule_phases").select("id").eq("schedule_id", scheduleId);
  await Promise.all((phases ?? []).map((ph) => {
    const range = phaseRange(after.filter((i) => i.phase_id === ph.id));
    return range ? sb.from("schedule_phases").update(range).eq("id", ph.id) : null;
  }));
  const schedPatch: Record<string, unknown> = { start_date: to, updated_at: now };
  if (sched.target_completion) schedPatch.target_completion = fmtISO(addWorkdays(parseISO(sched.target_completion)!, delta, wd));
  await sb.from("job_schedules").update(schedPatch).eq("id", scheduleId);
  await logActivity({ jobId: sched.job_id, scheduleId, action: "schedule_shifted", detail: { from: anchor, to, workdays: delta, moved: result.moved, skipped: result.skipped.length }, actor });

  // One heads-up per assigned person rather than one per task.
  const recipients = Array.from(new Set(items.filter((i) => moved.has(i.id)).flatMap((i) => assigneeStaffIds(i.assignees))));
  if (recipients.length) {
    await notifyScheduleEvent({ kind: "moved", recipientIds: recipients, jobId: sched.job_id, scheduleId, itemId: result.changes[0].id, title: `Rescheduled: ${sched.name}`, subtitle: `Now starts ${to}${result.finish ? `, finishes ${result.finish}` : ""}`, actorId: actor?.id });
  }
  return result;
}

// ---- participants ----
export async function listParticipants(scheduleId: string): Promise<ScheduleParticipant[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_participants").select("*").eq("schedule_id", scheduleId);
  return (data ?? []) as ScheduleParticipant[];
}
export async function addParticipant(scheduleId: string, input: Partial<ScheduleParticipant>): Promise<ScheduleParticipant> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("schedule_participants").upsert({ schedule_id: scheduleId, party_type: input.party_type ?? "staff", staff_id: input.staff_id ?? null, contact_id: input.contact_id ?? null, name: input.name ?? null, role: input.role ?? null, can_confirm: input.can_confirm ?? false }, { onConflict: "schedule_id,staff_id,contact_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data as ScheduleParticipant;
}
export async function removeParticipant(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("schedule_participants").delete().eq("id", id);
}

// ---- baselines ----
export async function listBaselines(scheduleId: string): Promise<ScheduleBaseline[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_baselines").select("*").eq("schedule_id", scheduleId).order("created_at", { ascending: false });
  return (data ?? []) as ScheduleBaseline[];
}
export async function captureBaseline(scheduleId: string, name: string, reason: string | null, actor?: Actor): Promise<ScheduleBaseline> {
  const sb = getSupabaseAdmin();
  const items = await listItems({ scheduleId });
  const snapshot = items.map((i) => ({ item_id: i.id, start_date: i.start_date, end_date: i.end_date }));
  // Stamp baseline_start/end on the items so the Gantt can render variance.
  await Promise.all(items.map((i) => sb.from("schedule_items").update({ baseline_start: i.start_date, baseline_end: i.end_date }).eq("id", i.id)));
  const { data, error } = await sb.from("schedule_baselines").insert({ schedule_id: scheduleId, name: name || "Baseline", snapshot, reason: reason ?? null, captured_by: actor?.id ?? null }).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity({ scheduleId, action: "baseline_captured", detail: { name, items: snapshot.length }, actor });
  return data as ScheduleBaseline;
}

// ---- job-level header + rollup ----
export type JobScheduleHeader = {
  schedule_count: number;
  active_count: number;
  overall_progress: number;
  health: string;
  projected_completion: string | null;
  next_milestone: { title: string; date: string | null; schedule_name: string } | null;
};

export async function jobScheduleHeader(jobId: string): Promise<JobScheduleHeader> {
  const schedules = await listSchedules(jobId);
  const active = schedules.filter((s) => s.status === "active");
  const overall = active.length ? Math.round(active.reduce((a, s) => a + (s.progress || 0), 0) / active.length) : 0;
  const rank = { critical: 4, delayed: 3, at_risk: 2, watch: 1, on_track: 0 } as Record<string, number>;
  const worst = active.reduce((w, s) => (rank[s.health] > rank[w] ? s.health : w), "on_track");
  const projected = active.reduce<string | null>((mx, s) => {
    const d = s.projected_completion || s.target_completion;
    return d && (!mx || d > mx) ? d : mx;
  }, null);
  // Next upcoming milestone across schedules.
  const today = fmtISO(new Date());
  const items = await listItems({ jobId });
  const upcoming = items
    .filter((i) => i.kind === "milestone" && i.status !== "complete" && i.status !== "cancelled" && i.start_date && i.start_date >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
  return {
    schedule_count: schedules.length,
    active_count: active.length,
    overall_progress: overall,
    health: worst,
    projected_completion: projected,
    next_milestone: upcoming ? { title: upcoming.title, date: upcoming.start_date, schedule_name: upcoming.schedule_name ?? "" } : null,
  };
}

// ---- global dashboard ----
export type GlobalScheduleRow = JobSchedule & { job_number: string | null; job_name: string; client: string | null };

export async function listAllSchedules(opts: { includeArchived?: boolean; limit?: number } = {}): Promise<GlobalScheduleRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("job_schedules").select("*, job:jobs(job_number, job_name)").order("updated_at", { ascending: false }).limit(opts.limit ?? 500);
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const [{ data }, names] = await Promise.all([q, staffNames()]);
  return withCounts((data ?? []).map((r: any) => ({ ...mapSchedule(r, names), job_number: r.job?.job_number ?? null, job_name: r.job?.job_name ?? "Job", client: null })));
}

// All items across every schedule (for the global dashboard), decorated with
// schedule + job labels. Capped for safety.
export type GlobalItem = ScheduleItem & { job_id: string | null; job_number?: string | null; job_name?: string | null };
export async function listAllItems(limit = 2000): Promise<GlobalItem[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_items").select("*").order("start_date", { ascending: true, nullsFirst: false }).limit(limit);
  const items = (data ?? []).map(mapItem) as GlobalItem[];
  const schedIds = Array.from(new Set(items.map((i) => i.schedule_id)));
  const jobIds = Array.from(new Set(items.map((i) => i.job_id).filter(Boolean))) as string[];
  const [{ data: scheds }, { data: jobs }] = await Promise.all([
    schedIds.length ? sb.from("job_schedules").select("id, name, type, color").in("id", schedIds) : Promise.resolve({ data: [] as any[] }),
    jobIds.length ? sb.from("jobs").select("id, job_number, job_name").in("id", jobIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const sMap = new Map((scheds ?? []).map((s) => [s.id, s]));
  const jMap = new Map((jobs ?? []).map((j) => [j.id, j]));
  for (const i of items) {
    const s = sMap.get(i.schedule_id); if (s) { i.schedule_name = s.name; i.schedule_type = s.type; i.schedule_color = s.color; }
    const j = i.job_id ? jMap.get(i.job_id) : null; if (j) { i.job_number = j.job_number; i.job_name = j.job_name; }
  }
  return items;
}

export type DashboardMetrics = {
  active_schedules: number; at_risk: number; delayed: number;
  due_today: number; due_this_week: number;
  waiting_client: number; waiting_vendor: number; waiting_inspection: number;
  upcoming_milestones: number; overdue: number;
};

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const sb = getSupabaseAdmin();
  const [{ data: scheds }, { data: items }] = await Promise.all([
    sb.from("job_schedules").select("status, health").neq("status", "archived"),
    sb.from("schedule_items").select("status, kind, start_date, end_date"),
  ]);
  const today = fmtISO(new Date());
  const weekEnd = fmtISO(new Date(Date.now() + 7 * 86400000));
  const its = items ?? [];
  const open = (i: any) => i.status !== "complete" && i.status !== "cancelled";
  return {
    active_schedules: (scheds ?? []).filter((s) => s.status === "active").length,
    at_risk: (scheds ?? []).filter((s) => s.health === "at_risk" || s.health === "watch").length,
    delayed: (scheds ?? []).filter((s) => s.health === "delayed" || s.health === "critical").length,
    due_today: its.filter((i) => open(i) && i.end_date === today).length,
    due_this_week: its.filter((i) => open(i) && i.end_date && i.end_date >= today && i.end_date <= weekEnd).length,
    waiting_client: its.filter((i) => i.status === "waiting_client").length,
    waiting_vendor: its.filter((i) => i.status === "waiting_vendor").length,
    waiting_inspection: its.filter((i) => i.status === "waiting_inspection").length,
    upcoming_milestones: its.filter((i) => i.kind === "milestone" && open(i) && i.start_date && i.start_date >= today && i.start_date <= weekEnd).length,
    overdue: its.filter((i) => open(i) && i.end_date && i.end_date < today).length,
  };
}
