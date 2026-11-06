// Resources (Phase 2 Step 7, Spec R2 §8). Pure, so the picker, the grid's
// Assign…, the cross-job view and the tests agree. A resource is a staff
// member, a trade partner (a company), or a generic trade label such as
// "Electrician" that can later be converted to a partner in one click.
// No levelling: the view only shows load and overlaps.
import type { Assignee } from "./types";

export const TRADE_PREFIX = "trade:";

/** A generic trade label as an assignee ("Electrician" → trade:electrician). */
export function tradeLabel(name: string): Assignee {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  return { id: `${TRADE_PREFIX}${clean.toLowerCase()}`, name: clean, type: "trade" };
}

export const resourceKey = (a: Pick<Assignee, "id" | "type">) => `${a.type ?? "staff"}:${a.id}`;

/** Add (or replace with) the given resources; no repeats. Remove by key. */
export function applyAssign(current: Assignee[] | null | undefined, add: Assignee[], mode: "add" | "replace" | "remove"): Assignee[] {
  const base = mode === "replace" ? [] : [...(current ?? [])];
  if (mode === "remove") {
    const drop = new Set(add.map(resourceKey));
    return base.filter((a) => !drop.has(resourceKey(a)));
  }
  const seen = new Set(base.map(resourceKey));
  for (const a of add) if (a?.id && a.name && !seen.has(resourceKey(a))) { seen.add(resourceKey(a)); base.push({ id: a.id, name: a.name, type: a.type ?? "staff" }); }
  return base;
}

/** Swap a generic trade label for a trade partner on one task's assignees. */
export function convertLabel(current: Assignee[] | null | undefined, labelId: string, partner: Assignee): { next: Assignee[]; changed: boolean } {
  const list = current ?? [];
  if (!list.some((a) => a.type === "trade" && a.id === labelId)) return { next: list, changed: false };
  return { next: applyAssign(list.filter((a) => !(a.type === "trade" && a.id === labelId)), [partner], "add"), changed: true };
}

export type LoadTask = { id: string; title: string; job_id: string | null; job_label?: string | null; schedule_id: string; status: string | null; start_date: string | null; end_date: string | null; assignees?: Assignee[] | null };
export type LoadCell = { week: string; taskIds: string[]; overlap: boolean };
export type LoadRow = { key: string; resource: Assignee; tasks: number; jobs: number; overlaps: number; cells: LoadCell[] };

const at = (s: string) => Date.parse(`${s}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Mondays of `weeks` weeks from the Monday of `from`. */
export function weekStarts(from: string, weeks: number): string[] {
  const d = new Date(at(from));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: weeks }, (_, n) => iso(d.getTime() + n * 7 * 86400000));
}

/** Weeks across, one row per resource. A week overlaps when two of the
 *  resource's open tasks share a weekday that week (any job). */
export function resourceLoad(tasks: LoadTask[], from: string, weeks: number): LoadRow[] {
  const starts = weekStarts(from, weeks);
  const rows = new Map<string, { resource: Assignee; tasks: LoadTask[] }>();
  for (const t of tasks) {
    if (!t.start_date || t.status === "complete" || t.status === "cancelled") continue;
    for (const a of t.assignees ?? []) {
      if (!a?.id) continue;
      const k = resourceKey(a);
      const r = rows.get(k) ?? { resource: { id: a.id, name: a.name, type: a.type ?? "staff" }, tasks: [] };
      r.tasks.push(t); rows.set(k, r);
    }
  }
  const out: LoadRow[] = [];
  for (const [key, r] of rows) {
    let overlaps = 0;
    const cells: LoadCell[] = starts.map((w) => {
      const wEnd = iso(at(w) + 4 * 86400000);
      const inWeek = r.tasks.filter((t) => t.start_date! <= wEnd && (t.end_date ?? t.start_date)! >= w);
      // Two tasks on the same weekday this week?
      let overlap = false;
      for (let d = 0; d < 5 && !overlap; d++) {
        const day = iso(at(w) + d * 86400000);
        if (inWeek.filter((t) => t.start_date! <= day && (t.end_date ?? t.start_date)! >= day).length > 1) overlap = true;
      }
      if (overlap) overlaps++;
      return { week: w, taskIds: inWeek.map((t) => t.id), overlap };
    });
    const busy = cells.some((c) => c.taskIds.length);
    if (!busy) continue;
    out.push({ key, resource: r.resource, tasks: new Set(cells.flatMap((c) => c.taskIds)).size, jobs: new Set(r.tasks.map((t) => t.job_id)).size, overlaps, cells });
  }
  const order = { staff: 0, vendor: 1, contractor: 1, trade: 2, client: 3 } as Record<string, number>;
  return out.sort((a, b) => (order[a.resource.type ?? "staff"] ?? 9) - (order[b.resource.type ?? "staff"] ?? 9) || b.overlaps - a.overlaps || a.resource.name.localeCompare(b.resource.name));
}
