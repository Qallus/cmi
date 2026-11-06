// Weekly schedule update, database side (Phase 2 Step 2, flag schedule_progress).
// Load the tasks for this update, push a late task with a reason (logged to the
// job's schedule activity), finish the update (status date → today and
// re-forecast), and draft the narrative with Bolt for the PM to edit. Nothing
// is sent anywhere; the PM copies it or posts it to today's daily log. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { callHermes, hermesConfigured } from "@/lib/canvas/bolt";
import { addNoteToDayLog, fieldReportsOn } from "@/lib/daily-logs/reports";
import { listItems, logActivity, syncScheduleProgress, updateItem } from "./data";
import { engineModeFor, recalcSchedule } from "./engine";
import { todayAZ } from "./progress.ts";
import { daysBetween, fallbackNarrative, updateRows, type UpdateFacts } from "./weekly-update.ts";
import type { ScheduleItem } from "./types";

type Actor = { id: string; name?: string | null; email?: string | null };

async function scheduleRow(id: string) {
  const { data } = await getSupabaseAdmin().from("job_schedules")
    .select("id, name, job_id, status_date, scheduling_mode, engine_finish").eq("id", id).maybeSingle();
  if (!data) throw Object.assign(new Error("Schedule not found."), { status: 404 });
  return data as { id: string; name: string; job_id: string | null; status_date: string | null; scheduling_mode: string | null; engine_finish: string | null };
}

const finishOf = (items: ScheduleItem[]) => items.reduce<string | null>((m, i) => {
  const d = i.end_date ?? i.start_date; return d && (!m || d > m) ? d : m;
}, null);

/** The tasks this update walks through (last status date → today). */
export async function loadUpdate(scheduleId: string) {
  const s = await scheduleRow(scheduleId);
  const today = todayAZ();
  const items = await listItems({ scheduleId });
  const rows = updateRows(items, s.status_date, today).map(({ task: i, flag }) => ({
    flag,
    task: {
      id: i.id, title: i.title, kind: i.kind, status: i.status, start_date: i.start_date, end_date: i.end_date,
      percent_complete: i.percent_complete ?? 0, actual_start: i.actual_start ?? null, actual_finish: i.actual_finish ?? null,
      assignees: (i.assignees ?? []).map((a) => a.name).filter(Boolean),
    },
  }));
  return {
    schedule: { id: s.id, name: s.name, job_id: s.job_id, status_date: s.status_date, engine: (s.scheduling_mode ?? "legacy") !== "legacy" },
    today, rows,
    canPostLog: !!s.job_id && (await fieldReportsOn()),
  };
}

/** Push a task that should have started, with a one-line reason for the record. */
export async function pushTask(scheduleId: string, itemId: string, to: string, reason: string, actor: Actor) {
  const { data: prev } = await getSupabaseAdmin().from("schedule_items").select("id, schedule_id, job_id, title, start_date, end_date").eq("id", itemId).maybeSingle();
  if (!prev || prev.schedule_id !== scheduleId) throw Object.assign(new Error("Task not found on this schedule."), { status: 404 });
  const engine = await engineModeFor(scheduleId);
  // On the engine a typed start becomes Start No Earlier Than and the length
  // stays in working days; the old forward push needs the end moved too.
  const patch: Partial<ScheduleItem> = { start_date: to };
  if (!engine && prev.start_date && prev.end_date) {
    const end = new Date(`${prev.end_date}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + daysBetween(prev.start_date, to));
    patch.end_date = end.toISOString().slice(0, 10);
  }
  const result = await updateItem(itemId, patch, actor);
  await logActivity({ jobId: prev.job_id, scheduleId, itemId, action: "update_pushed", detail: { title: prev.title, from: prev.start_date, to, reason }, actor });
  return result;
}

export type FinishResult = {
  from: string | null; to: string; finishBefore: string | null; finishAfter: string | null;
  moved: { id: string; title: string; from: string | null; to: string | null }[]; critical: string[];
};

/** Finish the update: status date → today, re-forecast, report what moved. */
export async function finishUpdate(scheduleId: string, actor: Actor): Promise<FinishResult> {
  const s = await scheduleRow(scheduleId);
  const to = todayAZ();
  const engine = (s.scheduling_mode ?? "legacy") !== "legacy" && !!(await engineModeFor(scheduleId));
  const finishBefore = engine ? s.engine_finish : finishOf(await listItems({ scheduleId }));
  await getSupabaseAdmin().from("job_schedules").update({ status_date: to, updated_at: new Date().toISOString() }).eq("id", scheduleId);
  let finishAfter = finishBefore;
  let moved: FinishResult["moved"] = [];
  let critical: string[] = [];
  if (engine) {
    const r = await recalcSchedule(scheduleId, actor);
    finishAfter = r.finish;
    moved = r.moved.map((m) => ({ id: m.id, title: m.title, from: m.from.start, to: m.to.start }));
    critical = r.critical.map((c) => c.title).filter(Boolean);
  } else {
    finishAfter = finishOf(await listItems({ scheduleId }));
  }
  await syncScheduleProgress(scheduleId);
  await logActivity({ jobId: s.job_id, scheduleId, action: "update_finished", detail: { from: s.status_date, to, finishBefore, finishAfter, moved: moved.length }, actor });
  return { from: s.status_date, to, finishBefore, finishAfter, moved, critical };
}

/** Everything the narrative may say, from the finished update and the period's records. */
async function factsFor(scheduleId: string, f: FinishResult): Promise<UpdateFacts> {
  const s = await scheduleRow(scheduleId);
  const sb = getSupabaseAdmin();
  const [items, { data: job }, { data: pushes }] = await Promise.all([
    listItems({ scheduleId }),
    s.job_id ? sb.from("jobs").select("job_number, job_name").eq("id", s.job_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("schedule_activity").select("detail, created_at").eq("schedule_id", scheduleId).eq("action", "update_pushed")
      .gte("created_at", `${f.from ?? f.to}T00:00:00-07:00`).order("created_at").limit(50),
  ]);
  const inPeriod = (d: string | null | undefined) => !!d && (!f.from || d >= f.from) && d <= f.to;
  const live = items.filter((i) => i.status !== "cancelled");
  const two = new Date(`${f.to}T12:00:00Z`); two.setUTCDate(two.getUTCDate() + 14);
  const horizon = two.toISOString().slice(0, 10);
  return {
    schedule: s.name,
    job: job ? (job.job_number || job.job_name) : null,
    from: f.from, to: f.to, finishBefore: f.finishBefore, finishAfter: f.finishAfter,
    completed: live.filter((i) => i.status === "complete" && inPeriod(i.actual_finish)).map((i) => i.title),
    started: live.filter((i) => inPeriod(i.actual_start) && i.status !== "complete").map((i) => i.title),
    inProgress: live.filter((i) => i.status !== "complete" && (i.percent_complete ?? 0) > 0).map((i) => ({ title: i.title, pct: i.percent_complete ?? 0 })),
    pushed: ((pushes ?? []) as { detail: { title?: string; reason?: string; to?: string } }[])
      .map((p) => ({ title: p.detail?.title ?? "A task", reason: p.detail?.reason ?? "", to: p.detail?.to ?? null })).filter((p) => p.reason),
    movedCount: f.moved.length,
    moved: f.moved.filter((m) => f.critical.includes(m.title)).slice(0, 8).map((m) => ({ title: m.title, from: m.from, to: m.to })),
    critical: f.critical,
    nextTwoWeeks: live.filter((i) => i.status !== "complete" && i.start_date && i.start_date > f.to && i.start_date <= horizon)
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")).map((i) => ({ title: i.title, start: i.start_date, end: i.end_date })),
  };
}

const RULES = `You write the weekly schedule update for Constructed Matter, Inc., a custom home builder, for the Project Manager to edit before anyone sees it.
Use ONLY the facts given. Never invent tasks, dates, people, causes or numbers. If something isn't in the facts, leave it out.
Plain language, short sentences, no hype. Dates like "Nov 9". Use these headings on their own lines, each followed by short "- " bullets:
Progress this period / Changes / Critical path / Risks / Next two weeks
Under Changes, give each push with its reason as given, and the forecast finish before → after. Tasks that moved with the re-forecast go in ONE bullet: the count (movedCount), naming only the critical ones listed in "moved". Never list every moved task.
Under Risks, only name risks the facts show (a later forecast finish, pushes, late critical tasks); if none, say "None reported."
Reply with the text only.`;

/** Bolt's draft of the narrative (or the plain version when Bolt isn't reachable). */
export async function draftNarrative(scheduleId: string, f: FinishResult): Promise<{ text: string; byBolt: boolean }> {
  const facts = await factsFor(scheduleId, f);
  if (hermesConfigured()) {
    const res = await callHermes([{ role: "system", content: RULES }, { role: "user", content: `FACTS (JSON):\n${JSON.stringify(facts).slice(0, 14_000)}` }], { temperature: 0.2 });
    if (!("error" in res) && res.content.trim()) return { text: res.content.trim(), byBolt: true };
  }
  return { text: fallbackNarrative(facts), byBolt: false };
}

/** Post the PM's edited narrative to the job's daily log for today (internal notes). */
export async function postNarrative(scheduleId: string, text: string, actor: Actor) {
  const s = await scheduleRow(scheduleId);
  if (!s.job_id) throw Object.assign(new Error("Only job schedules have a daily log."), { status: 400 });
  if (!(await fieldReportsOn())) throw Object.assign(new Error("Field Reports are switched off."), { status: 403 });
  const flat = text.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
  const log = await addNoteToDayLog(s.job_id, todayAZ(), { section: "internal", text: `Schedule update (${s.name}): ${flat}`.slice(0, 1000), full: text }, actor);
  return { logId: log.id, logNumber: log.log_number };
}
