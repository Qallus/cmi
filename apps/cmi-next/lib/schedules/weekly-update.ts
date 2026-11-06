// Weekly schedule update (Spec R2 §7.5, Phase 2 Step 2). Pure, so the panel,
// the API and the tests agree on which tasks belong in an update and what the
// fallback narrative says when Bolt isn't available.
//   In the update: tasks touching last status date → today, plus anything
//   still open that should have started or finished by today.
//   Flagged: planned to start by today but still at 0% ("start or push").

export type UpdateTask = {
  id: string; title: string; kind?: string | null; status?: string | null;
  start_date: string | null; end_date: string | null; percent_complete?: number | null;
  actual_start?: string | null; actual_finish?: string | null; phase_id?: string | null;
};

export type UpdateFlag = "not_started" | "finish_due" | null;
export type UpdateRow<T extends UpdateTask = UpdateTask> = { task: T; flag: UpdateFlag };

const closed = (t: UpdateTask) => t.status === "complete" || t.status === "cancelled" || (t.percent_complete ?? 0) >= 100;

/** The tasks a weekly update walks through, flagged ones first, then by start. */
export function updateRows<T extends UpdateTask>(tasks: T[], from: string | null, today: string): UpdateRow<T>[] {
  const out: UpdateRow<T>[] = [];
  for (const t of tasks) {
    if (t.kind === "phase" || t.status === "cancelled") continue;
    const pct = t.percent_complete ?? 0;
    const start = t.start_date, end = t.end_date ?? t.start_date;
    if (!start) continue;
    // Finished inside the period still shows (so the PM sees it was counted).
    const doneInPeriod = closed(t) && !!t.actual_finish && (!from || t.actual_finish >= from) && t.actual_finish <= today;
    const open = !closed(t);
    // Every open task planned to have started by today, however old.
    if (!(doneInPeriod || (open && start <= today))) continue;
    let flag: UpdateFlag = null;
    if (open && start <= today && pct === 0 && !t.actual_start) flag = "not_started";
    else if (open && end && end <= today) flag = "finish_due";
    out.push({ task: t, flag });
  }
  const rank = (r: UpdateRow) => (r.flag === "not_started" ? 0 : r.flag === "finish_due" ? 1 : closed(r.task) ? 3 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || (a.task.start_date ?? "").localeCompare(b.task.start_date ?? "") || a.task.title.localeCompare(b.task.title));
}

/** The next Monday–Friday day after `iso` (the default "push to" date). */
export function nextWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** Calendar days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

export type UpdateFacts = {
  schedule: string; job?: string | null; from: string | null; to: string;
  finishBefore: string | null; finishAfter: string | null;
  completed: string[]; inProgress: { title: string; pct: number }[]; started: string[];
  pushed: { title: string; reason: string; to?: string | null }[];
  moved: { title: string; from: string | null; to: string | null }[];
  critical: string[];
  nextTwoWeeks: { title: string; start: string | null; end: string | null }[];
};

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

/** A plain narrative from the facts alone (used when Bolt isn't reachable). */
export function fallbackNarrative(f: UpdateFacts): string {
  const lines: string[] = [];
  lines.push(`Schedule update: ${f.schedule}${f.job ? ` (${f.job})` : ""}, ${f.from ? `${fmt(f.from)} – ` : "through "}${fmt(f.to)}.`);
  lines.push("");
  lines.push("Progress this period");
  if (f.completed.length) lines.push(`- Completed: ${f.completed.join("; ")}.`);
  if (f.started.length) lines.push(`- Started: ${f.started.join("; ")}.`);
  if (f.inProgress.length) lines.push(`- In progress: ${f.inProgress.map((t) => `${t.title} (${t.pct}%)`).join("; ")}.`);
  if (!f.completed.length && !f.started.length && !f.inProgress.length) lines.push("- No progress was reported this period.");
  lines.push("");
  lines.push("Changes");
  if (f.finishBefore !== f.finishAfter) {
    const d = f.finishBefore && f.finishAfter ? daysBetween(f.finishBefore, f.finishAfter) : null;
    lines.push(`- Forecast finish moved from ${fmt(f.finishBefore)} to ${fmt(f.finishAfter)}${d ? ` (${d > 0 ? "+" : ""}${d} days)` : ""}.`);
  } else lines.push(`- Forecast finish holds at ${fmt(f.finishAfter)}.`);
  for (const p of f.pushed) lines.push(`- ${p.title} was pushed${p.to ? ` to ${fmt(p.to)}` : ""}: ${p.reason}`);
  if (f.moved.length) lines.push(`- ${f.moved.length} task${f.moved.length === 1 ? "" : "s"} moved with the re-forecast.`);
  if (f.critical.length) { lines.push(""); lines.push("Critical path"); lines.push(`- ${f.critical.slice(0, 8).join(" → ")}`); }
  lines.push("");
  lines.push("Next two weeks");
  if (f.nextTwoWeeks.length) for (const t of f.nextTwoWeeks.slice(0, 12)) lines.push(`- ${t.title}: ${fmt(t.start)} – ${fmt(t.end)}`);
  else lines.push("- Nothing is scheduled to start.");
  return lines.join("\n");
}
