// Resources, database side (Phase 2 Step 7). The pool to pick from (staff,
// trade partners, trade labels already in use), assigning several tasks at
// once, converting a trade label to a partner, and the cross-job load view.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateItem, logActivity } from "./data";
import { applyAssign, convertLabel, resourceLoad, tradeLabel, type LoadTask } from "./resources.ts";
import type { Assignee } from "./types";

type Actor = { id: string; name?: string | null };

const COMMON_TRADES = ["Carpenter", "Concrete", "Drywall", "Electrician", "Excavation", "Flooring", "Framing", "HVAC", "Insulation", "Landscaping", "Masonry", "Painter", "Plumber", "Roofing", "Stucco", "Tile", "Windows & Doors"];

export type PoolEntry = Assignee & { sub?: string | null };

/** Staff, trade partners and trade labels matching `q` (all staff and labels when empty). */
export async function resourcePool(q: string): Promise<PoolEntry[]> {
  const sb = getSupabaseAdmin();
  const term = q.replace(/[%,()]/g, " ").trim();
  const like = `%${term}%`;
  const [{ data: staff }, { data: cos }, { data: used }] = await Promise.all([
    sb.from("staff_users").select("id, display_name, role_slug").eq("status", "active").order("display_name").limit(100),
    term.length >= 2
      ? sb.from("companies").select("id, name, trades, qualification_status").is("archived_at", null).ilike("name", like).limit(12)
      : Promise.resolve({ data: [] as { id: string; name: string; trades: string[] | null; qualification_status: string | null }[] }),
    sb.from("schedule_items").select("assignees").limit(2000),
  ]);
  const low = term.toLowerCase();
  const match = (s: string) => !low || s.toLowerCase().includes(low);
  const out: PoolEntry[] = [];
  for (const s of (staff ?? []) as { id: string; display_name: string | null; role_slug: string | null }[]) {
    if (s.display_name && match(s.display_name)) out.push({ id: s.id, name: s.display_name, type: "staff", sub: (s.role_slug ?? "").replace(/_/g, " ") || "Staff" });
  }
  for (const c of (cos ?? []) as { id: string; name: string; trades: string[] | null; qualification_status: string | null }[]) {
    out.push({ id: c.id, name: c.name, type: "vendor", sub: ["Trade partner", (c.trades ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ") });
  }
  const labels = new Map<string, PoolEntry>();
  for (const r of (used ?? []) as { assignees: Assignee[] | null }[]) for (const a of r.assignees ?? []) if (a?.type === "trade" && match(a.name)) labels.set(a.id, { ...a, sub: "Trade (no partner yet)" });
  for (const n of COMMON_TRADES) { const l = tradeLabel(n); if (match(n) && !labels.has(l.id)) labels.set(l.id, { ...l, sub: "Trade (no partner yet)" }); }
  out.push(...[...labels.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20));
  return out;
}

/** Assign (add / replace / remove) resources on several tasks of one schedule. */
export async function assignTasks(scheduleId: string, itemIds: string[], resources: Assignee[], mode: "add" | "replace" | "remove", actor: Actor): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_items").select("id, schedule_id, assignees").in("id", itemIds.slice(0, 500));
  let n = 0;
  for (const it of (data ?? []) as { id: string; schedule_id: string; assignees: Assignee[] | null }[]) {
    if (it.schedule_id !== scheduleId) continue;
    const next = applyAssign(it.assignees, resources, mode);
    if (JSON.stringify(next) === JSON.stringify(it.assignees ?? [])) continue;
    // updateItem notifies newly added staff and records the change.
    await updateItem(it.id, { assignees: next }, actor, { cascade: false });
    n++;
  }
  return n;
}

/** Replace a trade label with a trade partner on every task that has it (one job, or all). */
export async function convertTradeLabel(labelId: string, partner: { id: string; name: string }, opts: { jobId?: string | null }, actor: Actor): Promise<number> {
  const sb = getSupabaseAdmin();
  let q = sb.from("schedule_items").select("id, job_id, schedule_id, assignees").limit(3000);
  if (opts.jobId) q = q.eq("job_id", opts.jobId);
  const { data } = await q;
  const to: Assignee = { id: partner.id, name: partner.name, type: "vendor" };
  let n = 0;
  for (const it of (data ?? []) as { id: string; job_id: string | null; schedule_id: string; assignees: Assignee[] | null }[]) {
    const { next, changed } = convertLabel(it.assignees, labelId, to);
    if (!changed) continue;
    await sb.from("schedule_items").update({ assignees: next, updated_at: new Date().toISOString(), updated_by: actor.id }).eq("id", it.id);
    n++;
  }
  if (n) await logActivity({ jobId: opts.jobId ?? null, action: "trade_converted", detail: { label: labelId, partner: partner.name, tasks: n }, actor });
  return n;
}

/** Every job schedule's open tasks with assignees in the window, as rows per resource. */
export async function loadResourceView(from: string, weeks: number) {
  const sb = getSupabaseAdmin();
  const end = new Date(Date.parse(`${from}T12:00:00Z`) + weeks * 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("schedule_items")
    .select("id, title, job_id, schedule_id, status, start_date, end_date, assignees, job:jobs(job_number, job_name), schedule:job_schedules!inner(status)")
    .not("status", "in", "(complete,cancelled)").neq("schedule.status", "archived")
    .lte("start_date", end).gte("end_date", new Date(Date.parse(`${from}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)).limit(4000);
  type Row = LoadTask & { job: { job_number: string | null; job_name: string | null } | null };
  const tasks = ((data ?? []) as unknown as Row[]).filter((r) => (r.assignees ?? []).length).map((r) => ({ ...r, job_label: r.job?.job_number || r.job?.job_name || null }));
  const rows = resourceLoad(tasks, from, weeks);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, { id: t.id, title: t.title, job_id: t.job_id, job_label: t.job_label, schedule_id: t.schedule_id, start_date: t.start_date, end_date: t.end_date }]));
  return { rows, tasks: byId };
}
