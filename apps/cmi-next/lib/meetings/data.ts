import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Meeting, MeetingListItem, SaveMeetingPayload } from "./types";

export const MEETING_BUCKET = "meeting-recordings";

const WRITABLE = [
  "title", "meeting_type", "status", "meeting_date", "duration_seconds", "location",
  "contact_id", "project_item_id", "quote_id", "document_id", "staff_user_id",
  "related_records", "attendees", "recording_bucket", "recording_path",
  "recording_filename", "recording_mime", "recordings", "image_url", "attachments", "transcript", "summary",
  "action_items", "ai_suggestions", "follow_up_notes", "internal_notes",
  "client_notes", "client_visible",
] as const;

const JOINS = "contact:contacts(first_name,last_name,email), project:project_schedule_items(title), creator:staff_users!meetings_created_by_fkey(display_name)";
const LIST_COLUMNS =
  "id,title,meeting_type,status,meeting_date,duration_seconds,location,contact_id,project_item_id,quote_id,document_id,staff_user_id,related_records,attendees,recording_path,recordings,image_url,summary,action_items,client_visible,created_by,created_at,updated_at";

export async function loadMeetings(opts: {
  all: boolean; staffId: string | null;
  filters?: { status?: string; meeting_type?: string; contact_id?: string; project_item_id?: string; search?: string; from?: string; to?: string };
}): Promise<MeetingListItem[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("meetings").select(`${LIST_COLUMNS}, ${JOINS}`).order("meeting_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);

  if (!opts.all) q = q.or(`created_by.eq.${opts.staffId},staff_user_id.eq.${opts.staffId}`);

  const f = opts.filters ?? {};
  // Hide archived by default; show them only when explicitly filtered to "archived".
  if (f.status) q = q.eq("status", f.status);
  else q = q.neq("status", "archived");
  if (f.meeting_type) q = q.eq("meeting_type", f.meeting_type);
  if (f.contact_id) q = q.eq("contact_id", f.contact_id);
  if (f.project_item_id) q = q.eq("project_item_id", f.project_item_id);
  if (f.from) q = q.gte("meeting_date", f.from);
  if (f.to) q = q.lte("meeting_date", f.to);
  if (f.search) q = q.ilike("title", `%${f.search.replace(/[,%()]/g, " ")}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MeetingListItem[];
}

export async function loadMeeting(id: string): Promise<Meeting | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("meetings").select(`*, ${JOINS}`).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as Meeting | null;
}

function pick(payload: SaveMeetingPayload): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const k of WRITABLE) if (k in payload && (payload as Record<string, unknown>)[k] !== undefined) row[k] = (payload as Record<string, unknown>)[k];
  return row;
}

export async function saveMeeting(payload: SaveMeetingPayload, staffId: string | null): Promise<Meeting> {
  const sb = getSupabaseAdmin();
  const row = pick(payload);
  row.updated_at = new Date().toISOString();
  row.updated_by = staffId;

  let id = payload.id;
  if (!id) {
    row.created_by = staffId;
    const { data, error } = await sb.from("meetings").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id as string;
  } else {
    const { error } = await sb.from("meetings").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }
  const m = await loadMeeting(id!);
  if (!m) throw new Error("Meeting not found after save.");
  return m;
}

export async function updateMeetingFields(id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("meetings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

type RecEntry = { id: string; path: string; filename: string; mime?: string; created_at?: string; transcript?: string };

// Append a recording to the meeting's recordings array; mirror to the legacy
// primary recording_path if none is set yet.
export async function addRecordingEntry(id: string, entry: { path: string; filename: string; mime?: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("meetings").select("recordings, recording_path").eq("id", id).maybeSingle();
  const list: RecEntry[] = Array.isArray(data?.recordings) ? data!.recordings : [];
  const rec: RecEntry = { id: `rec-${Date.now()}-${Math.round(Math.random() * 1e6)}`, path: entry.path, filename: entry.filename, mime: entry.mime, created_at: new Date().toISOString() };
  const next = [...list, rec];
  const patch: Record<string, unknown> = { recordings: next, updated_at: new Date().toISOString() };
  if (!data?.recording_path) {
    patch.recording_bucket = MEETING_BUCKET; patch.recording_path = entry.path;
    patch.recording_filename = entry.filename; patch.recording_mime = entry.mime ?? null;
  }
  const { error } = await sb.from("meetings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeRecordingEntry(id: string, recordingId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("meetings").select("recordings, recording_path, recording_filename, recording_mime").eq("id", id).maybeSingle();
  const list: RecEntry[] = Array.isArray(data?.recordings) ? data!.recordings : [];
  const target = list.find((r) => r.id === recordingId);
  const next = list.filter((r) => r.id !== recordingId);
  if (target?.path) await sb.storage.from(MEETING_BUCKET).remove([target.path]).catch(() => {});
  const patch: Record<string, unknown> = { recordings: next, updated_at: new Date().toISOString() };
  // If we removed the legacy primary, repoint it to the first remaining (or clear).
  if (target?.path && target.path === data?.recording_path) {
    if (next[0]) { patch.recording_path = next[0].path; patch.recording_filename = next[0].filename; patch.recording_mime = next[0].mime ?? null; }
    else { patch.recording_path = null; patch.recording_filename = null; patch.recording_mime = null; patch.recording_bucket = null; }
  }
  const { error } = await sb.from("meetings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function downloadByPath(path: string): Promise<Blob | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.storage.from(MEETING_BUCKET).download(path);
  return data ?? null;
}

// Remove just the audio recording (keeps the meeting, transcript, notes).
export async function removeRecording(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("meetings").select("recording_bucket, recording_path").eq("id", id).maybeSingle();
  if (data?.recording_path) {
    await sb.storage.from(data.recording_bucket || MEETING_BUCKET).remove([data.recording_path]).catch(() => {});
  }
  const { error } = await sb.from("meetings").update({
    recording_bucket: null, recording_path: null, recording_filename: null, recording_mime: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMeeting(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  // Best-effort remove of the stored recording.
  const { data } = await sb.from("meetings").select("recording_bucket, recording_path").eq("id", id).maybeSingle();
  if (data?.recording_path) {
    await sb.storage.from(data.recording_bucket || MEETING_BUCKET).remove([data.recording_path]).catch(() => {});
  }
  const { error } = await sb.from("meetings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Storage helpers ─────────────────────────────────────────────────────────────

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "recording";
}

export async function createRecordingUploadUrl(meetingId: string, filename: string): Promise<{ path: string; token: string; signedUrl: string } | { error: string }> {
  const sb = getSupabaseAdmin();
  const path = `${meetingId}/${Date.now()}-${safeName(filename)}`;
  const { data, error } = await sb.storage.from(MEETING_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || "Could not create upload URL." };
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function getRecordingPlaybackUrl(bucket: string, path: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.storage.from(bucket || MEETING_BUCKET).createSignedUrl(path, 7200);
  return data?.signedUrl ?? null;
}

export async function downloadRecording(bucket: string, path: string): Promise<Blob | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.storage.from(bucket || MEETING_BUCKET).download(path);
  return data ?? null;
}
