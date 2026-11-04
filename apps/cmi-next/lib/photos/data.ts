// Field Reports, Step 3: one Photos library per job. Every upload anywhere
// (daily log, phone camera, job Files, Client Updates, Executive Summary)
// writes a row here; daily logs and summaries point at photo ids. Files never
// move: the row holds the URL. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { exifTakenAt } from "./exif";
import { dedupeUrls, IMAGE_EXT } from "./urls";

export const FIELD_REPORTS_FLAG = "field_reports";

export const PHOTO_SOURCES = ["daily_log", "job_file", "job_update", "phone", "exec_summary", "upload"] as const;
export type PhotoSource = (typeof PHOTO_SOURCES)[number];

export type JobPhoto = {
  id: string; job_id: string; url: string; storage: string; taken_at: string | null;
  uploaded_by: string | null; uploaded_by_id: string | null;
  source_type: PhotoSource; source_id: string | null;
  area: string | null; trade: string | null; tags: string[]; caption: string | null;
  client_ok: boolean; starred: boolean; created_at: string; updated_at: string;
};

/** The first bytes of a photo, to read when it was taken (best effort, never throws). */
async function takenAtOf(url: string): Promise<string | null> {
  if (!/\.jpe?g$/i.test(url.replace(/\?.*$/, "")) && IMAGE_EXT.test(url.replace(/\?.*$/, ""))) return null; // PNG etc. carry no EXIF date
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(url, { headers: { Range: "bytes=0-131071" }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok && res.status !== 206) return null;
    return exifTakenAt(new Uint8Array(await res.arrayBuffer()));
  } catch { return null; }
}

/**
 * Add photos to a job's library. Already-listed URLs are left as they are
 * (the first source wins). Does nothing while Field Reports is off.
 */
export async function recordPhotos(jobId: string | null | undefined, urls: (string | null | undefined)[], meta: {
  source_type: PhotoSource; source_id?: string | null; uploaded_by?: string | null; uploaded_by_id?: string | null;
  client_ok?: boolean; caption?: string | null; area?: string | null; trade?: string | null;
}): Promise<JobPhoto[]> {
  if (!jobId) return [];
  const list = dedupeUrls(urls);
  if (!list.length || !(await isFeatureEnabled(FIELD_REPORTS_FLAG))) return [];
  try {
    const now = new Date().toISOString();
    const taken = await Promise.all(list.map(takenAtOf));
    const rows = list.map((url, i) => ({
      job_id: jobId, url, taken_at: taken[i] ?? now,
      uploaded_by: meta.uploaded_by ?? null, uploaded_by_id: meta.uploaded_by_id ?? null,
      source_type: meta.source_type, source_id: meta.source_id ?? null,
      client_ok: !!meta.client_ok, caption: meta.caption ?? null, area: meta.area ?? null, trade: meta.trade ?? null,
    }));
    const sb = getSupabaseAdmin();
    await sb.from("job_photos").upsert(rows, { onConflict: "job_id,url", ignoreDuplicates: true });
    const { data } = await sb.from("job_photos").select("*").eq("job_id", jobId).in("url", list);
    return (data ?? []) as JobPhoto[];
  } catch { return []; /* the library must never block an upload */ }
}

export type PhotoFilters = { from?: string | null; to?: string | null; source?: string | null; area?: string | null; trade?: string | null; clientOk?: boolean | null; tag?: string | null };

export async function listPhotos(jobId: string, f: PhotoFilters = {}): Promise<JobPhoto[]> {
  let q = getSupabaseAdmin().from("job_photos").select("*").eq("job_id", jobId);
  if (f.from) q = q.gte("taken_at", `${f.from}T00:00:00-07:00`);
  if (f.to) q = q.lte("taken_at", `${f.to}T23:59:59-07:00`);
  if (f.source && (PHOTO_SOURCES as readonly string[]).includes(f.source)) q = q.eq("source_type", f.source);
  if (f.area) q = q.eq("area", f.area);
  if (f.trade) q = q.eq("trade", f.trade);
  if (f.clientOk != null) q = q.eq("client_ok", f.clientOk);
  if (f.tag) q = q.contains("tags", [f.tag]);
  const { data, error } = await q.order("taken_at", { ascending: false, nullsFirst: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as JobPhoto[];
}

export async function photosByIds(ids: string[]): Promise<JobPhoto[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabaseAdmin().from("job_photos").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map(((data ?? []) as JobPhoto[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as JobPhoto[];
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || null : v === null ? null : undefined);

/** Bulk edit (area, trade, tags, caption, client OK, star) on photos of one job. */
export async function updatePhotos(jobId: string, ids: string[], patch: Record<string, unknown>): Promise<JobPhoto[]> {
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, n] of [["area", 80], ["trade", 80], ["caption", 500]] as const) { const v = clip(patch[k], n); if (v !== undefined) clean[k] = v; }
  if (Array.isArray(patch.tags)) clean.tags = [...new Set(patch.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  if (typeof patch.client_ok === "boolean") clean.client_ok = patch.client_ok;
  if (typeof patch.starred === "boolean") clean.starred = patch.starred;
  if (!ids.length || Object.keys(clean).length === 1) return [];
  const { data, error } = await getSupabaseAdmin().from("job_photos").update(clean).eq("job_id", jobId).in("id", ids).select("*");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as JobPhoto[];
  // Keep job Files' own client flag in step, so the portal shows one answer.
  if (typeof clean.client_ok === "boolean") {
    const fileIds = rows.filter((r) => r.source_type === "job_file" && r.source_id).map((r) => r.source_id!) ;
    if (fileIds.length) await getSupabaseAdmin().from("job_files").update({ client_visible: clean.client_ok }).eq("job_id", jobId).in("id", fileIds);
  }
  return rows;
}

/** Remove from the library only (the file itself stays where it was saved). */
export async function removePhotos(jobId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await getSupabaseAdmin().from("job_photos").delete().eq("job_id", jobId).in("id", ids);
  if (error) throw new Error(error.message);
}

/** Distinct areas and trades used on a job, for filter and edit pickers. */
export async function photoFacets(jobId: string): Promise<{ areas: string[]; trades: string[]; tags: string[] }> {
  const { data } = await getSupabaseAdmin().from("job_photos").select("area, trade, tags").eq("job_id", jobId).limit(2000);
  const areas = new Set<string>(), trades = new Set<string>(), tags = new Set<string>();
  for (const r of (data ?? []) as { area: string | null; trade: string | null; tags: string[] | null }[]) {
    if (r.area) areas.add(r.area);
    if (r.trade) trades.add(r.trade);
    for (const t of r.tags ?? []) tags.add(t);
  }
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { areas: sort(areas), trades: sort(trades), tags: sort(tags) };
}
