// Progress stamping for schedule tasks (Spec R2 §7.1, Phase 2). Pure, so the
// item editor, the grid and the Excel import all apply the same rules:
//   % above 0    stamps Actual Start (today) unless one is set, status In progress
//   % = 100      stamps Actual Finish (today) unless one is set, status Complete
//   % back to 0  clears both actuals, status Not started
//   Actual Finish typed   → 100%, Complete
//   Actual Start typed    → In progress (if it was not started)
//   Status Complete       → 100% and the actuals stamped
// Changing % clears a typed Remaining so the forecast follows the new %.

type Prev = {
  percent_complete?: number | null; actual_start?: string | null; actual_finish?: string | null;
  status?: string | null; start_date?: string | null; remaining_duration?: number | null;
};

const NOT_STARTED = new Set(["not_started", "ready", "scheduled", "confirmed", null, undefined, ""]);

/** Today's date in Arizona (no DST), as YYYY-MM-DD. */
export function todayAZ(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The extra fields a patch implies. Returns only what to add or change. */
export function progressPatch(prev: Prev, patch: Record<string, unknown>, today: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const has = (k: string) => k in patch;
  const startOf = () => (has("actual_start") ? (patch.actual_start as string | null) : prev.actual_start) ?? null;

  if (has("status") && patch.status === "complete" && !has("percent_complete")) {
    out.percent_complete = 100;
    if (!startOf()) out.actual_start = prev.start_date && prev.start_date <= today ? prev.start_date : today;
    if (!has("actual_finish") && !prev.actual_finish) out.actual_finish = today;
    return out;
  }

  if (has("actual_finish") && patch.actual_finish) {
    if (!has("percent_complete")) out.percent_complete = 100;
    if (!has("status")) out.status = "complete";
    if (!startOf()) out.actual_start = patch.actual_finish as string;
    return out;
  }

  if (has("percent_complete")) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(patch.percent_complete) || 0)));
    if (pct !== Number(patch.percent_complete)) out.percent_complete = pct;
    if (pct === (prev.percent_complete ?? 0) && !has("actual_start")) return out;
    if (!has("remaining_duration") && prev.remaining_duration != null) out.remaining_duration = null;
    if (pct === 0) {
      if (!has("actual_start")) out.actual_start = null;
      if (!has("actual_finish")) out.actual_finish = null;
      if (!has("status") && !NOT_STARTED.has(prev.status ?? null)) out.status = "not_started";
      return out;
    }
    if (!startOf()) out.actual_start = today;
    if (pct === 100) {
      if (!has("actual_finish") && !prev.actual_finish) out.actual_finish = today;
      if (!has("status")) out.status = "complete";
    } else {
      if (!has("actual_finish") && prev.actual_finish) out.actual_finish = null;
      if (!has("status") && (NOT_STARTED.has(prev.status ?? null) || prev.status === "complete")) out.status = "in_progress";
    }
    return out;
  }

  if (has("actual_start") && patch.actual_start && !has("status") && NOT_STARTED.has(prev.status ?? null)) out.status = "in_progress";
  return out;
}
