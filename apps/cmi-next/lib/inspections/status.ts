// Inspection milestones, Step 4: status, request-by dates and hold points. Pure,
// so the drawer, the API, the lookahead, the Today page and the tests agree.
// Statuses are Brandon's (Read Me tab of the milestone library).
import { formatCutoff } from "./settings.ts";

export type InspectionStatus =
  | "not_ready" | "ready_to_call" | "requested" | "scheduled" | "passed" | "partial" | "failed" | "reinspect_requested" | "na";

export const INSPECTION_STATUSES: { value: InspectionStatus; label: string; tone: "neutral" | "info" | "good" | "warn" | "bad"; hint: string }[] = [
  { value: "not_ready", label: "Not Ready", tone: "neutral", hint: "The work before it isn't done" },
  { value: "ready_to_call", label: "Ready to Call", tone: "info", hint: "Work is done; request the inspection" },
  { value: "requested", label: "Requested", tone: "info", hint: "Requested; waiting for a date" },
  { value: "scheduled", label: "Scheduled", tone: "info", hint: "The jurisdiction gave a date" },
  { value: "passed", label: "Passed", tone: "good", hint: "Passed; the work it holds can start" },
  { value: "partial", label: "Partial", tone: "warn", hint: "Part passed; the rest needs another visit" },
  { value: "failed", label: "Failed / Correction", tone: "bad", hint: "Corrections needed; pick the re-inspection date" },
  { value: "reinspect_requested", label: "Re-inspect Requested", tone: "warn", hint: "Corrections done; re-inspection requested" },
  { value: "na", label: "N/A", tone: "neutral", hint: "Doesn't apply; stays on record, out of the forecast" },
];
const LABEL = new Map(INSPECTION_STATUSES.map((s) => [s.value, s.label]));
export const inspectionStatusLabel = (s: string | null | undefined) => (s ? LABEL.get(s as InspectionStatus) ?? s : "Not Ready");
export const isInspectionStatus = (s: unknown): s is InspectionStatus => typeof s === "string" && LABEL.has(s as InspectionStatus);

/** Statuses that clear a hold point. */
export const CLEARS_HOLD = new Set<string>(["passed", "na"]);
/** Still to be requested: the ones a "Call today" list is about. */
export const TO_REQUEST = new Set<string>(["not_ready", "ready_to_call"]);
/** Asked for, waiting on the jurisdiction ("Waiting on inspection"). */
export const WAITING = new Set<string>(["requested", "scheduled", "reinspect_requested", "failed", "partial"]);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export type InspectionPrev = {
  inspection_status: string | null; status: string | null; internal_notes: string | null;
  actual_start?: string | null; actual_finish?: string | null;
};
export type InspectionChange = { status: string; date?: string | null; note?: string | null };

/**
 * The schedule_items patch for a status change. Passed finishes the milestone
 * (actual dates, 100%), so the work it releases can start; Failed needs the
 * re-inspection date and moves the milestone there (start-no-earlier-than, so
 * the forecast pushes what follows); a date on Requested / Scheduled /
 * Re-inspect does the same. N/A cancels it: kept on record, held at its date.
 * Every change adds a dated line to the internal notes.
 */
export function inspectionPatch(prev: InspectionPrev, change: InspectionChange, ctx: { today: string; who?: string | null }): { patch: Record<string, unknown> } | { error: string } {
  const s = change.status;
  if (!isInspectionStatus(s)) return { error: "Pick a status." };
  const date = change.date ? String(change.date) : null;
  if (date && !isIso(date)) return { error: "Pick a valid date." };
  const note = (change.note ?? "").trim().slice(0, 2000);
  if (s === "failed" && !date) return { error: "Failed needs the re-inspection date." };
  if (s === "failed" && !note) return { error: "Add a note on the corrections." };

  const patch: Record<string, unknown> = { inspection_status: s };
  const wasDone = prev.inspection_status === "passed" || prev.status === "complete";
  const moveTo = (d: string) => Object.assign(patch, { start_date: d, end_date: d, constraint_type: "snet", constraint_date: d });

  switch (s) {
    case "passed": {
      const d = date ?? ctx.today;
      Object.assign(patch, { status: "complete", percent_complete: 100, actual_start: prev.actual_start ?? d, actual_finish: d });
      break;
    }
    case "na":
      Object.assign(patch, { status: "cancelled" });
      break;
    case "failed":
    case "reinspect_requested":
    case "requested":
      patch.status = "waiting_inspection";
      if (date) moveTo(date);
      break;
    case "scheduled":
      patch.status = "scheduled";
      if (date) moveTo(date);
      break;
    case "partial":
      patch.status = "in_progress";
      if (date) moveTo(date);
      break;
    case "ready_to_call":
      patch.status = "ready";
      break;
    default:
      patch.status = "not_started";
  }
  if (wasDone && s !== "passed") Object.assign(patch, { actual_start: null, actual_finish: null, percent_complete: 0 });

  const line = `[${ctx.today}] ${inspectionStatusLabel(s)}${date && s !== "passed" ? ` for ${date}` : date ? ` on ${date}` : ""}${ctx.who ? ` (${ctx.who})` : ""}${note ? `: ${note}` : ""}`;
  patch.internal_notes = prev.internal_notes ? `${prev.internal_notes.trimEnd()}\n${line}` : line;
  return { patch };
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayMs = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * When to request an inspection for `inspectionDate`: by the jurisdiction's
 * next-business-day cutoff on the working day before (Mon–Fri; a Monday
 * inspection is requested by Friday). Null when the cutoff isn't published.
 */
export function requestBy(inspectionDate: string | null | undefined, cutoffMinutes: number | null | undefined, method?: string | null):
  { date: string; minutes: number; label: string } | null {
  if (!inspectionDate || !isIso(inspectionDate) || cutoffMinutes == null) return null;
  let d = new Date(toDate(inspectionDate).getTime() - dayMs);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - dayMs);
  const time = formatCutoff(cutoffMinutes);
  const how = method?.trim() ? ` (${method.trim()})` : "";
  return { date: toIso(d), minutes: cutoffMinutes, label: `Request by ${DOW[d.getUTCDay()]} ${time === "Midnight" ? "midnight" : time}${how}` };
}

export type HoldItem = { id: string; title: string; kind: string; inspection_step_id?: string | null; inspection_status?: string | null; status?: string | null };
export type HoldLink = { source_item_id: string; target_item_id: string };

/** Inspections before `itemId` that haven't passed: starting it now skips a hold point. */
export function unpassedInspectionsBefore(itemId: string, links: HoldLink[], items: HoldItem[]): HoldItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return links.filter((l) => l.target_item_id === itemId)
    .map((l) => byId.get(l.source_item_id))
    .filter((i): i is HoldItem => !!i && !!i.inspection_step_id && i.status !== "cancelled" && !CLEARS_HOLD.has(i.inspection_status ?? "not_ready"));
}

/** Patches that start or finish a task (status in progress / complete, an actual start, or progress above 0). */
export function startsWork(patch: Record<string, unknown>): boolean {
  return patch.status === "in_progress" || patch.status === "complete" || !!patch.actual_start || Number(patch.percent_complete ?? 0) > 0;
}
