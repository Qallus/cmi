// Schedule health tiles (Spec R2 §7.4, Phase 2 Step 5). Pure, so the schedule
// page, the Today page and the tests read the same numbers:
//   Forecast vs baseline    forecast finish − baseline finish, working days (+ = late)
//   Forecast vs contract    the contract milestone furthest behind (+ = late)
//   Behind                  open tasks that should have started / finished by the status date
//   Critical                open tasks on the critical path (engine schedules)
//   Float on the finish     working days from the forecast finish to the contract
//                           completion (or the schedule's target); negative = late
//   Weather days            closed weather days on the work calendar so far
//   Late selections         tasks waiting on a selection that isn't decided in time
// Every tile carries the tasks behind it so the page can list them.
import { dayNum, workDiff, countExceptions, type DayCalendar, type WorkCalendar } from "./calendar.ts";
import { inspectionStatusLabel, WAITING } from "../inspections/status.ts";

export type HealthItem = {
  id: string; title: string; kind: string; status: string | null;
  start_date: string | null; end_date: string | null; percent_complete?: number | null;
  baseline_end?: string | null; is_critical?: boolean | null; total_float?: number | null;
  milestone_type?: string | null; contract_date?: string | null;
  link_type?: string | null; link_id?: string | null;
  inspection_step_id?: string | null; inspection_status?: string | null;
};
export type HealthSelection = { id: string; name: string; status: string | null; target_decision_date: string | null };
export type HealthInput = {
  items: HealthItem[]; selections: HealthSelection[];
  cal: DayCalendar; workCalendar: WorkCalendar | null;
  onEngine: boolean; statusDate: string | null; today: string;
  engineFinish: string | null; targetCompletion: string | null; startDate: string | null;
};

export type HealthTone = "good" | "warn" | "bad" | "neutral";
export type HealthTile = {
  key: "baseline" | "contract" | "behind" | "critical" | "float" | "weather" | "selections" | "inspections";
  label: string; value: string; note?: string; tone: HealthTone;
  /** The tasks this tile is about (for the drill-down list). */
  tasks: { id: string; title: string; detail?: string }[];
};
export type Health = { finish: string | null; tiles: HealthTile[]; issues: number };

const DECIDED = new Set(["approved", "selected", "ordered", "delivered", "installed", "complete", "completed", "decided"]);
const open = (i: HealthItem) => i.status !== "complete" && i.status !== "cancelled" && (i.percent_complete ?? 0) < 100;
const endOf = (i: HealthItem) => (i.kind === "milestone" ? i.start_date : i.end_date ?? i.start_date);
const wd = (n: number) => `${n > 0 ? "+" : ""}${n} wd`;
const fmt = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");

export function scheduleHealth(h: HealthInput): Health {
  const live = h.items.filter((i) => i.status !== "cancelled");
  const finish = h.onEngine && h.engineFinish ? h.engineFinish : live.reduce<string | null>((m, i) => { const e = endOf(i); return e && (!m || e > m) ? e : m; }, null);
  const tiles: HealthTile[] = [];

  // Forecast vs baseline.
  const based = live.filter((i) => i.baseline_end);
  const baseFinish = based.reduce<string | null>((m, i) => (!m || i.baseline_end! > m ? i.baseline_end! : m), null);
  if (baseFinish && finish) {
    const v = workDiff(h.cal, dayNum(baseFinish), dayNum(finish));
    const slipped = based.map((i) => ({ i, v: endOf(i) ? workDiff(h.cal, dayNum(i.baseline_end!), dayNum(endOf(i)!)) : 0 })).filter((x) => x.v > 0 && open(x.i)).sort((a, b) => b.v - a.v);
    tiles.push({ key: "baseline", label: "vs baseline", value: v === 0 ? "On date" : wd(v), note: `Baseline finish ${fmt(baseFinish)}`, tone: v > 0 ? "bad" : "good",
      tasks: slipped.slice(0, 25).map((x) => ({ id: x.i.id, title: x.i.title, detail: wd(x.v) })) });
  } else tiles.push({ key: "baseline", label: "vs baseline", value: "—", note: "No baseline yet", tone: "neutral", tasks: [] });

  // Forecast vs contract (the contract milestone furthest behind).
  const contract = live.filter((i) => i.contract_date && endOf(i)).map((i) => ({ i, v: workDiff(h.cal, dayNum(i.contract_date!), dayNum(endOf(i)!)) })).sort((a, b) => b.v - a.v);
  if (contract.length) {
    const w = contract[0];
    tiles.push({ key: "contract", label: "vs contract", value: w.v === 0 ? "On date" : wd(w.v), note: w.i.title, tone: w.v > 0 ? "bad" : "good",
      tasks: contract.map((x) => ({ id: x.i.id, title: x.i.title, detail: `contract ${fmt(x.i.contract_date)} · forecast ${fmt(endOf(x.i))} (${wd(x.v)})` })) });
  } else tiles.push({ key: "contract", label: "vs contract", value: "—", note: "No contract dates", tone: "neutral", tasks: [] });

  // Behind the status date (today when none is set).
  const asOf = h.statusDate ?? h.today;
  const behind = live.filter((i) => open(i) && ((endOf(i) && endOf(i)! <= asOf) || (i.start_date && i.start_date <= asOf && !(i.percent_complete ?? 0))));
  tiles.push({ key: "behind", label: "Behind", value: String(behind.length), note: `as of ${fmt(asOf)}`, tone: behind.length ? "warn" : "good",
    tasks: behind.slice(0, 50).map((i) => ({ id: i.id, title: i.title, detail: endOf(i)! <= asOf ? `finish was ${fmt(endOf(i))}` : `start was ${fmt(i.start_date)}` })) });

  // Critical tasks (engine only).
  if (h.onEngine) {
    const crit = live.filter((i) => i.is_critical && open(i) && i.total_float != null);
    tiles.push({ key: "critical", label: "Critical", value: String(crit.length), note: "open tasks, no float", tone: "neutral",
      tasks: crit.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")).slice(0, 50).map((i) => ({ id: i.id, title: i.title, detail: `${fmt(i.start_date)} – ${fmt(endOf(i))}` })) });
  }

  // Float on the finish: to the contract completion, else the schedule's target.
  const completion = live.filter((i) => i.milestone_type === "contract" && i.contract_date).reduce<HealthItem | null>((m, i) => (!m || i.contract_date! > m.contract_date! ? i : m), null);
  const target = completion?.contract_date ?? h.targetCompletion;
  if (target && finish) {
    const f = workDiff(h.cal, dayNum(finish), dayNum(target));
    tiles.push({ key: "float", label: "Float on finish", value: `${f} wd`, note: `${completion ? "to contract" : "to target"} ${fmt(target)}`, tone: f < 0 ? "bad" : f <= 5 ? "warn" : "good", tasks: [] });
  } else tiles.push({ key: "float", label: "Float on finish", value: "—", note: "No contract or target date", tone: "neutral", tasks: [] });

  // Weather days so far on this schedule's calendar.
  if (h.workCalendar) {
    const from = h.startDate ?? live.reduce<string | null>((m, i) => (i.start_date && (!m || i.start_date < m) ? i.start_date : m), null) ?? h.today;
    const counts = countExceptions(h.workCalendar, from, h.today);
    const days = h.workCalendar.exceptions.filter((e) => !e.working && e.type === "weather" && e.date >= from && e.date <= h.today);
    tiles.push({ key: "weather", label: "Weather days", value: String(counts.weather), note: `since ${fmt(from)}`, tone: counts.weather ? "warn" : "neutral",
      tasks: days.map((e) => ({ id: `weather-${e.date}`, title: fmt(e.date), detail: e.label ?? undefined })) });
  }

  // Late selections.
  const sel = new Map(h.selections.map((s) => [s.id, s]));
  const late = live.filter((i) => open(i) && i.link_type === "selection" && i.link_id && sel.has(i.link_id)).flatMap((i) => {
    const s = sel.get(i.link_id!)!;
    if (DECIDED.has((s.status ?? "").toLowerCase())) return [];
    const due = s.target_decision_date;
    const lateNow = (due && (due < h.today || (i.start_date && due > i.start_date))) || (!due && i.start_date && i.start_date <= h.today);
    return lateNow ? [{ id: i.id, title: i.title, detail: `${s.name}${due ? ` · due ${fmt(due)}` : " · no decision date"}` }] : [];
  });
  tiles.push({ key: "selections", label: "Late selections", value: String(late.length), note: "not decided in time", tone: late.length ? "bad" : "good", tasks: late });

  // Waiting on inspection (only on schedules with inspection milestones): requested, scheduled,
  // failed, partial or re-inspect requested, and not yet passed.
  const insp = live.filter((i) => i.inspection_step_id && i.inspection_status && open(i));
  if (insp.length) {
    const waiting = insp.filter((i) => WAITING.has(i.inspection_status ?? ""));
    const failed = waiting.filter((i) => i.inspection_status === "failed").length;
    tiles.push({
      key: "inspections", label: "Waiting on inspection", value: String(waiting.length),
      note: failed ? `${failed} failed / correction` : `${insp.length} inspection${insp.length === 1 ? "" : "s"} open`,
      tone: failed ? "bad" : waiting.length ? "warn" : "good",
      tasks: waiting.map((i) => ({ id: i.id, title: i.title, detail: `${inspectionStatusLabel(i.inspection_status)}${i.start_date ? ` · ${fmt(i.start_date)}` : ""}` })),
    });
  }

  const issues = tiles.filter((t) => t.tone === "bad" || t.tone === "warn").length;
  return { finish, tiles, issues };
}
