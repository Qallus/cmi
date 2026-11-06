// Full edit of a daily log (Ben's request, 2026-11-06): change the photos and
// attachments (add, or remove ones from the wrong job), the text and who sees
// it, and move the log to another job. Works for older logs and Field Reports.
// A Field Report moved onto a job that already has a log that day is merged
// into it. The Photos library and the commitments made from the log follow
// the move. Changes after Submit are recorded. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { recordPhotos } from "@/lib/photos/data";
import { dedupeUrls } from "@/lib/photos/urls";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";
import { autoTitle } from "./data";
import { mergeCapture, normalizeSections, sectionsText } from "./sections";
import type { DailyLog } from "./types";

type Actor = { id: string; email?: string | null; name?: string | null };
type Attachment = { url: string; type: string; name?: string | null };

export type LogEdit = {
  notes?: string | null; photos?: string[]; attachments?: Attachment[];
  visibility?: "team" | "private"; include_in_brief?: boolean; client_visible?: boolean;
  /** Move the log to this job. */
  jobId?: string;
};

const isUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u) && u.length < 2000;

/** Only real links, no repeats. */
export function cleanEdit(b: Record<string, unknown>): LogEdit {
  const out: LogEdit = {};
  if (typeof b.notes === "string" || b.notes === null) out.notes = b.notes as string | null;
  if (Array.isArray(b.photos)) out.photos = dedupeUrls(b.photos.filter(isUrl));
  if (Array.isArray(b.attachments)) {
    const seen = new Set<string>();
    out.attachments = (b.attachments as Attachment[]).filter((a) => a && isUrl(a.url) && typeof a.type === "string" && !seen.has(a.url) && seen.add(a.url))
      .map((a) => ({ url: a.url, type: a.type.slice(0, 20), name: typeof a.name === "string" ? a.name.slice(0, 200) : null }));
  }
  if (b.visibility === "team" || b.visibility === "private") out.visibility = b.visibility;
  if (typeof b.include_in_brief === "boolean") out.include_in_brief = b.include_in_brief;
  if (typeof b.client_visible === "boolean") out.client_visible = b.client_visible;
  if (typeof b.jobId === "string" && b.jobId) out.jobId = b.jobId;
  return out;
}

async function recordChange(log: DailyLog & { status?: string | null }, actor: Actor, field: string, oldValue: unknown, newValue: unknown) {
  if (log.status !== "submitted") return;
  try {
    await getSupabaseAdmin().from("record_changes").insert({
      table_name: "daily_logs", record_id: log.id, record_label: log.title, op: "update", field,
      old_value: oldValue == null ? null : String(typeof oldValue === "string" ? oldValue : JSON.stringify(oldValue)).slice(0, 4000),
      new_value: newValue == null ? null : String(typeof newValue === "string" ? newValue : JSON.stringify(newValue)).slice(0, 4000),
      changed_by: actor.id,
    });
  } catch { /* the audit trail must not block a save */ }
}

/** Point the log's Photos-library rows and commitments at another job (and log). */
async function followMove(fromLogId: string, fromJobId: string, toJobId: string, toLogId: string) {
  const sb = getSupabaseAdmin();
  const { data: pics } = await sb.from("job_photos").select("id, url").eq("job_id", fromJobId).eq("source_type", "daily_log").eq("source_id", fromLogId);
  if (pics?.length) {
    const { data: there } = await sb.from("job_photos").select("url").eq("job_id", toJobId).in("url", pics.map((p) => p.url));
    const dup = new Set((there ?? []).map((p) => p.url));
    const move = pics.filter((p) => !dup.has(p.url)).map((p) => p.id);
    const drop = pics.filter((p) => dup.has(p.url)).map((p) => p.id);
    if (move.length) await sb.from("job_photos").update({ job_id: toJobId, source_id: toLogId, updated_at: new Date().toISOString() }).in("id", move);
    if (drop.length) await sb.from("job_photos").delete().in("id", drop);
  }
  const { data: commits } = await sb.from("commitments").select("id, source_ref").eq("source", "daily_log").like("source_ref", `daily_log:${fromLogId}:%`);
  for (const c of commits ?? []) {
    await sb.from("commitments").update({ job_id: toJobId, source_ref: String(c.source_ref).replace(`daily_log:${fromLogId}:`, `daily_log:${toLogId}:`) }).eq("id", c.id);
  }
}

/** Apply an edit. Returns the log as saved (after a merge, the log it merged into). */
export async function editDailyLog(logId: string, edit: LogEdit, actor: Actor): Promise<{ log: DailyLog; movedTo?: string; merged?: boolean }> {
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from("daily_logs").select("*").eq("id", logId).maybeSingle();
  if (!cur) throw Object.assign(new Error("Daily log not found."), { status: 404 });
  const log = cur as DailyLog & { report_version?: number; status?: string | null; sections?: unknown; log_number?: number | null };
  if (!log.job_id) throw Object.assign(new Error("Only job logs can be edited here."), { status: 400 });
  const v2 = log.report_version === 2;

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Text: older logs keep their rich text; Field Reports are edited by section on the card.
  if (edit.notes !== undefined && !v2) {
    upd.notes = edit.notes ? sanitizeHtmlServer(edit.notes) || null : null;
    upd.title = autoTitle({ notes: upd.notes as string | null });
  }
  if (edit.visibility) upd.visibility = edit.visibility;
  if (edit.include_in_brief !== undefined) upd.include_in_brief = edit.include_in_brief;
  if (edit.client_visible !== undefined && !v2) upd.client_visible = edit.client_visible && (edit.visibility ?? log.visibility) !== "private";
  if (edit.visibility === "private") upd.client_visible = false;

  const before = dedupeUrls(log.photos ?? []);
  if (edit.photos) upd.photos = edit.photos;
  if (edit.attachments) upd.attachments = edit.attachments;

  const { data: saved, error } = await sb.from("daily_logs").update(upd).eq("id", logId).select("*").single();
  if (error) throw new Error(error.message);

  // Photos library: drop the removed ones, add the new ones.
  if (edit.photos) {
    const removed = before.filter((u) => !edit.photos!.includes(u));
    const added = edit.photos.filter((u) => !before.includes(u));
    if (removed.length) await sb.from("job_photos").delete().eq("job_id", log.job_id).eq("source_type", "daily_log").eq("source_id", logId).in("url", removed);
    if (added.length) await recordPhotos(log.job_id, added, { source_type: "daily_log", source_id: logId, uploaded_by: actor.email ?? null, uploaded_by_id: actor.id });
    if (removed.length || added.length) await recordChange(log, actor, "photos", `${before.length} photo(s)`, `${edit.photos.length} photo(s): ${removed.length} removed, ${added.length} added`);
  }
  if (edit.notes !== undefined && !v2 && upd.notes !== log.notes) await recordChange(log, actor, "notes", log.notes, upd.notes);

  if (!edit.jobId || edit.jobId === log.job_id) return { log: saved as DailyLog };

  // ---- Move to another job ----
  const { data: job } = await sb.from("jobs").select("id, job_number, job_name").eq("id", edit.jobId).maybeSingle();
  if (!job) throw Object.assign(new Error("That job wasn't found."), { status: 404 });
  const from = saved as typeof log;
  if (v2) {
    const { data: there } = await sb.from("daily_logs").select("*").eq("job_id", edit.jobId).eq("log_date", from.log_date).eq("report_version", 2).maybeSingle();
    if (there) {
      // That job already has a log for the day: combine the two.
      const target = there as typeof log;
      const a = normalizeSections(target.sections), b = normalizeSections(from.sections);
      const sections = mergeCapture(a, { items: b.items });
      sections.raw = [...a.raw, ...b.raw];
      const attachments = [...(target.attachments ?? [])];
      for (const x of from.attachments ?? []) if (!attachments.some((y) => y.url === x.url)) attachments.push(x);
      const { data: merged, error: e2 } = await sb.from("daily_logs").update({
        sections, notes: sectionsText(sections) || target.notes, photos: dedupeUrls([...(target.photos ?? []), ...(from.photos ?? [])]), attachments,
        updated_at: new Date().toISOString(),
      }).eq("id", target.id).select("*").single();
      if (e2) throw new Error(e2.message);
      await followMove(from.id, from.job_id!, edit.jobId, target.id);
      await recordChange(target, actor, "merged in", null, `${from.title ?? "A daily log"} moved here from another job`);
      await sb.from("daily_logs").delete().eq("id", from.id);
      return { log: merged as DailyLog, movedTo: edit.jobId, merged: true };
    }
    // Next log number on the new job.
    const { data: last } = await sb.from("daily_logs").select("log_number").eq("job_id", edit.jobId).eq("report_version", 2).order("log_number", { ascending: false }).limit(1).maybeSingle();
    const n = ((last?.log_number as number | null) ?? 0) + 1;
    const title = `Daily Log #${n} · ${new Date(`${from.log_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data: moved, error: e3 } = await sb.from("daily_logs").update({ job_id: edit.jobId, log_number: n, title, updated_at: new Date().toISOString() }).eq("id", from.id).select("*").single();
    if (e3) throw new Error(e3.message);
    await followMove(from.id, from.job_id!, edit.jobId, from.id);
    await recordChange(from, actor, "job", from.job_id, edit.jobId);
    return { log: moved as DailyLog, movedTo: edit.jobId };
  }
  const { data: moved, error: e4 } = await sb.from("daily_logs").update({ job_id: edit.jobId, updated_at: new Date().toISOString() }).eq("id", from.id).select("*").single();
  if (e4) throw new Error(e4.message);
  await followMove(from.id, from.job_id!, edit.jobId, from.id);
  return { log: moved as DailyLog, movedTo: edit.jobId };
}
