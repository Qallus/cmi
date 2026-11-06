// Field Reports, Steps 1–2: one daily log per job per day. Every capture
// (typed, dictated, photo) appends to that day's log, creating it as a Draft
// with the next log number; dictation is sorted into the template. Submit
// locks the log (later edits are recorded in record_changes) and turns its
// action items into internal commitments. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { weatherForSite } from "@/lib/weather";
import { htmlToText } from "@/lib/notes/html";
import { createCommitment } from "@/lib/commitments/data";
import { recordPhotos, FIELD_REPORTS_FLAG } from "@/lib/photos/data";
import { dedupeUrls } from "@/lib/photos/urls";
import { cleanItem, emptySections, mergeCapture, normalizeSections, sectionsText, type LogItem, type LogSections } from "./sections";
import { structureDictation, type StructureContext } from "./structure";
import type { DailyLog } from "./types";

export { FIELD_REPORTS_FLAG };
export const fieldReportsOn = () => isFeatureEnabled(FIELD_REPORTS_FLAG);

export type FieldReport = DailyLog & {
  report_version: number; sections: LogSections; status: "draft" | "submitted";
  log_number: number | null; submitted_by: string | null; submitted_at: string | null;
};

export type Actor = { id: string; email?: string | null; name?: string | null };

function asReport(r: Record<string, unknown>): FieldReport {
  return { ...(r as unknown as FieldReport), sections: normalizeSections(r.sections) };
}

const titleOf = (n: number | null, date: string) => `Daily Log${n ? ` #${n}` : ""} · ${new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

/** That day's field report for the job, created as a Draft if there isn't one. */
export async function getOrCreateDayLog(jobId: string, date: string, actor?: Actor): Promise<FieldReport> {
  const sb = getSupabaseAdmin();
  const find = () => sb.from("daily_logs").select("*").eq("job_id", jobId).eq("log_date", date).eq("report_version", 2).maybeSingle();
  const { data: found } = await find();
  if (found) return asReport(found);
  const [{ data: last }, weather] = await Promise.all([
    sb.from("daily_logs").select("log_number").eq("job_id", jobId).eq("report_version", 2).order("log_number", { ascending: false }).limit(1).maybeSingle(),
    weatherForSite("job", jobId, date).catch(() => null),
  ]);
  const n = ((last?.log_number as number | null) ?? 0) + 1;
  const { data, error } = await sb.from("daily_logs").insert({
    job_id: jobId, log_date: date, report_version: 2, status: "draft", log_number: n, title: titleOf(n, date),
    sections: emptySections(), photos: [], attachments: [], visibility: "team", client_visible: false, include_in_brief: false,
    weather: weather?.weather ?? null, temperature: weather?.temperature ?? null,
    created_by: actor?.email ?? null, created_by_id: actor?.id ?? null,
  }).select("*").single();
  if (error?.code === "23505") { const { data: again } = await find(); if (again) return asReport(again); }
  if (error || !data) throw new Error(error?.message ?? "Couldn't start today's log.");
  return asReport(data);
}

/** Who and what the structure pass should know about this job. */
async function contextFor(jobId: string, date: string): Promise<StructureContext> {
  const sb = getSupabaseAdmin();
  const from = new Date(`${date}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - 3);
  const to = new Date(`${date}T12:00:00Z`); to.setUTCDate(to.getUTCDate() + 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [{ data: job }, { data: vendors }, { data: staff }, { data: tasks }] = await Promise.all([
    sb.from("jobs").select("job_name").eq("id", jobId).maybeSingle(),
    sb.from("job_vendors").select("role, vendor:contacts(first_name, last_name, company)").eq("job_id", jobId),
    sb.from("staff_users").select("display_name").eq("status", "active").limit(60),
    sb.from("schedule_items").select("title, start_date, end_date").eq("job_id", jobId).lte("start_date", iso(to)).gte("end_date", iso(from)).limit(40),
  ]);
  type V = { role: string | null; vendor: { first_name: string | null; last_name: string | null; company: string | null } | null };
  return {
    jobName: (job?.job_name as string) ?? "Job", date,
    tradePartners: ((vendors ?? []) as unknown as V[]).map((v) => [v.vendor?.company || [v.vendor?.first_name, v.vendor?.last_name].filter(Boolean).join(" "), v.role].filter(Boolean).join(" (") + (v.role ? ")" : "")).filter(Boolean),
    staff: ((staff ?? []) as { display_name: string | null }[]).map((s) => s.display_name).filter(Boolean) as string[],
    scheduleThisWeek: ((tasks ?? []) as { title: string; start_date: string | null; end_date: string | null }[]).map((t) => `${t.title} (${t.start_date ?? "?"} – ${t.end_date ?? "?"})`),
  };
}

async function logChange(log: FieldReport, actor: Actor | undefined, field: string, oldValue: unknown, newValue: unknown) {
  try {
    await getSupabaseAdmin().from("record_changes").insert({
      table_name: "daily_logs", record_id: log.id, record_label: log.title, op: "update", field,
      old_value: oldValue == null ? null : String(typeof oldValue === "string" ? oldValue : JSON.stringify(oldValue)).slice(0, 4000),
      new_value: newValue == null ? null : String(typeof newValue === "string" ? newValue : JSON.stringify(newValue)).slice(0, 4000),
      changed_by: actor?.id ?? null,
    });
  } catch { /* the audit trail must not block a save */ }
}

export type Capture = {
  /** Typed or dictated text (HTML or plain). */
  notes?: string | null;
  /** The voice note this text came from, when dictated. */
  audioUrl?: string | null;
  dictated?: boolean;
  photos?: string[];
  attachments?: { url: string; type: string; name?: string | null }[];
};

/** Add one capture to the job's log for that day (Draft or Submitted). */
export async function appendToDayLog(jobId: string, date: string, cap: Capture, actor?: Actor): Promise<FieldReport> {
  const log = await getOrCreateDayLog(jobId, date, actor);
  const text = htmlToText(cap.notes ?? "").trim();
  let sections = log.sections;
  if (text) {
    // Typed or dictated, it's sorted into the template the same way ("say it however it comes out").
    const dictated = !!cap.dictated || !!cap.audioUrl;
    const { items, sorted } = await structureDictation(text, await contextFor(jobId, date));
    const source: LogItem["source"] = dictated ? "dictated" : "typed";
    sections = mergeCapture(sections, {
      items: items.map((i) => ({ ...i, source, at: new Date().toISOString() })),
      raw: { at: new Date().toISOString(), text, audio_url: cap.audioUrl ?? null, by: actor?.name ?? actor?.email ?? null, ...(sorted ? {} : { unsorted: true }) },
    });
  }
  const photos = dedupeUrls([...(log.photos ?? []), ...(cap.photos ?? [])]);
  const attachments = [...(log.attachments ?? [])];
  for (const a of cap.attachments ?? []) if (a?.url && !attachments.some((x) => x.url === a.url)) attachments.push({ url: a.url, type: a.type, name: a.name ?? null });
  const { data, error } = await getSupabaseAdmin().from("daily_logs").update({
    sections, photos, attachments, notes: sectionsText(sections) || log.notes, updated_at: new Date().toISOString(),
  }).eq("id", log.id).select("*").single();
  if (error) throw new Error(error.message);
  const next = asReport(data);
  if (log.status === "submitted") await logChange(log, actor, "capture added after submit", null, text || `${(cap.photos ?? []).length} photo(s)`);
  if (cap.photos?.length) await recordPhotos(jobId, cap.photos, { source_type: "daily_log", source_id: log.id, uploaded_by: actor?.email ?? null, uploaded_by_id: actor?.id ?? null });
  return next;
}

/** Add an already-sorted note (no structure pass), e.g. the weekly schedule
 *  update. The item is capped like any other; the full text goes in the record. */
export async function addNoteToDayLog(jobId: string, date: string, note: { section: LogItem["section"]; text: string; full?: string }, actor?: Actor): Promise<FieldReport> {
  const log = await getOrCreateDayLog(jobId, date, actor);
  const item = cleanItem({ section: note.section, text: note.text, source: "typed", at: new Date().toISOString() }, note.section);
  if (!item) return log;
  const sections = mergeCapture(log.sections, {
    items: [item],
    raw: { at: new Date().toISOString(), text: note.full ?? note.text, by: actor?.name ?? actor?.email ?? null },
  });
  const { data, error } = await getSupabaseAdmin().from("daily_logs").update({
    sections, notes: sectionsText(sections) || log.notes, updated_at: new Date().toISOString(),
  }).eq("id", log.id).select("*").single();
  if (error) throw new Error(error.message);
  if (log.status === "submitted") await logChange(log, actor, "note added after submit", null, note.text);
  return asReport(data);
}

/** Edits from the review screen: the whole sections body (and/or weather). */
export async function updateDayLog(logId: string, patch: { sections?: unknown; weather?: string | null; temperature?: string | null; notes_html?: string | null }, actor?: Actor): Promise<FieldReport> {
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from("daily_logs").select("*").eq("id", logId).eq("report_version", 2).maybeSingle();
  if (!cur) throw new Error("Daily log not found.");
  const before = asReport(cur);
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.sections !== undefined) {
    const s = normalizeSections(patch.sections);
    s.raw = before.sections.raw; // the word-for-word record isn't editable
    upd.sections = s; upd.notes = sectionsText(s) || null;
  }
  if (patch.weather !== undefined) upd.weather = patch.weather;
  if (patch.temperature !== undefined) upd.temperature = patch.temperature;
  const { data, error } = await sb.from("daily_logs").update(upd).eq("id", logId).select("*").single();
  if (error) throw new Error(error.message);
  const after = asReport(data);
  if (before.status === "submitted") {
    if (upd.sections) await logChange(before, actor, "sections", sectionsText(before.sections), sectionsText(after.sections));
    if (patch.weather !== undefined && patch.weather !== before.weather) await logChange(before, actor, "weather", before.weather, patch.weather);
  }
  return after;
}

/** Find a staff member by the name said in dictation ("Ben", "Ben Peck"). */
async function staffByName(name: string | null | undefined): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;
  const { data } = await getSupabaseAdmin().from("staff_users").select("id, display_name, first_name, last_name").eq("status", "active").limit(200);
  const people = (data ?? []) as { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[];
  const low = n.toLowerCase();
  const exact = people.find((p) => (p.display_name ?? "").toLowerCase() === low || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim().toLowerCase() === low);
  if (exact) return exact.id;
  const first = people.filter((p) => (p.first_name ?? p.display_name?.split(" ")[0] ?? "").toLowerCase() === low.split(" ")[0]);
  return first.length === 1 ? first[0].id : null;
}

/** Submit: lock the log and file its action items as internal commitments (once each). */
export async function submitDayLog(logId: string, actor: Actor): Promise<{ log: FieldReport; commitments: number; failed: string[] }> {
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from("daily_logs").select("*").eq("id", logId).eq("report_version", 2).maybeSingle();
  if (!cur) throw new Error("Daily log not found.");
  const log = asReport(cur);
  const items = [...log.sections.items];
  let made = 0;
  const failed: string[] = [];
  for (const [idx, i] of items.entries()) {
    if (i.section !== "actions" || i.commitment_id) continue;
    const owner = await staffByName(i.owner);
    try {
      const { commitment } = await createCommitment({
        title: i.text.slice(0, 200),
        details: [`From ${log.title ?? "the daily log"}.`, i.owner && !owner ? `Owner as said: ${i.owner}.` : null].filter(Boolean).join(" "),
        owner_staff_id: owner ?? actor.id, job_id: log.job_id, source: "daily_log", source_ref: `daily_log:${log.id}:${i.id}`,
        due_on: i.due ?? null, waiting_on: "none",
      }, { id: actor.id }, "dashboard");
      items[idx] = { ...i, commitment_id: commitment.id };
      made++;
    } catch (e) { failed.push(`${i.text.slice(0, 60)}: ${(e as Error).message}`); /* one bad item doesn't stop the submit */ }
  }
  const { data, error } = await sb.from("daily_logs").update({
    status: "submitted", submitted_by: actor.id, submitted_at: new Date().toISOString(),
    sections: { ...log.sections, items }, updated_at: new Date().toISOString(),
  }).eq("id", logId).select("*").single();
  if (error) throw new Error(error.message);
  return { log: asReport(data), commitments: made, failed };
}

/** Back to Draft (Admins / PMs), recorded. */
export async function reopenDayLog(logId: string, actor: Actor): Promise<FieldReport> {
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from("daily_logs").select("*").eq("id", logId).eq("report_version", 2).maybeSingle();
  if (!cur) throw new Error("Daily log not found.");
  const { data, error } = await sb.from("daily_logs").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", logId).select("*").single();
  if (error) throw new Error(error.message);
  await logChange(asReport(cur), actor, "status", "submitted", "draft");
  return asReport(data);
}

/** A job's field reports, newest day first. */
export async function listDayLogs(jobId: string, opts: { from?: string; to?: string } = {}): Promise<FieldReport[]> {
  let q = getSupabaseAdmin().from("daily_logs").select("*").eq("job_id", jobId).eq("report_version", 2);
  if (opts.from) q = q.gte("log_date", opts.from);
  if (opts.to) q = q.lte("log_date", opts.to);
  const { data, error } = await q.order("log_date", { ascending: false }).limit(400);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(asReport);
}

/** Edits made after a log was submitted (from record_changes), newest first. */
export async function dayLogChanges(logId: string): Promise<{ at: string; field: string; old_value: string | null; new_value: string | null; by: string | null }[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("record_changes").select("changed_at, field, old_value, new_value, changed_by").eq("table_name", "daily_logs").eq("record_id", logId).order("changed_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as { changed_at: string; field: string; old_value: string | null; new_value: string | null; changed_by: string | null }[];
  const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await sb.from("staff_users").select("id, display_name").in("id", ids);
    for (const p of people ?? []) names.set(p.id, p.display_name ?? "Staff");
  }
  return rows.map((r) => ({ at: r.changed_at, field: r.field, old_value: r.old_value, new_value: r.new_value, by: r.changed_by ? names.get(r.changed_by) ?? "Staff" : null }));
}
