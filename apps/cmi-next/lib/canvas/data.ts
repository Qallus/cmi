// Data layer for Project Canvas. All access goes through the service role;
// per-actor authorization is enforced here (client sees only their own canvases,
// staff see all). Annotations jsonb is the single source of truth.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CanvasActor } from "./actor";
import { removeCanvasMedia } from "./storage";
import {
  CANVAS_ANNOTATIONS_VERSION, EMPTY_ANNOTATIONS,
  type CanvasComment, type CanvasPin, type CanvasProject, type CanvasScene, type CanvasStatus, type SceneAnnotations,
} from "./types";

export class CanvasError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function normalizeAnnotations(raw: unknown): SceneAnnotations {
  const a = (raw ?? {}) as Partial<SceneAnnotations>;
  return {
    v: typeof a.v === "number" ? a.v : CANVAS_ANNOTATIONS_VERSION,
    strokes: Array.isArray(a.strokes) ? a.strokes : [],
    shapes: Array.isArray(a.shapes) ? a.shapes : [],
    pins: Array.isArray(a.pins) ? a.pins : [],
    stamps: Array.isArray(a.stamps) ? a.stamps : [],
  };
}

function rowToScene(r: Record<string, unknown>): CanvasScene {
  return {
    id: r.id as string,
    canvas_id: r.canvas_id as string,
    position: Number(r.position) || 0,
    media_path: (r.media_path as string | null) ?? null,
    source_video_path: (r.source_video_path as string | null) ?? null,
    annotations: normalizeAnnotations(r.annotations),
    flattened_path: (r.flattened_path as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

// ── Access ──────────────────────────────────────────────────────────
export function canActorAccess(actor: CanvasActor, canvas: Pick<CanvasProject, "owner_contact_id">): boolean {
  if (actor.kind === "staff") return true;
  return canvas.owner_contact_id === actor.contactId;
}
// Clients may only mutate their own DRAFT canvases; staff may always write.
export function canActorWrite(actor: CanvasActor, canvas: Pick<CanvasProject, "owner_contact_id" | "status">): boolean {
  if (actor.kind === "staff") return true;
  return canvas.owner_contact_id === actor.contactId && canvas.status === "draft";
}

// ── Canvases ────────────────────────────────────────────────────────
export async function listCanvases(actor: CanvasActor, opts: { jobId?: string; status?: string } = {}): Promise<CanvasProject[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("canvas_projects").select("*").order("updated_at", { ascending: false }).limit(100);
  if (actor.kind === "client") q = q.eq("owner_contact_id", actor.contactId);
  if (opts.jobId) q = q.eq("job_id", opts.jobId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new CanvasError(error.message, 500);
  return (data ?? []) as CanvasProject[];
}

export async function getCanvas(id: string): Promise<CanvasProject | null> {
  const { data, error } = await getSupabaseAdmin().from("canvas_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new CanvasError(error.message, 500);
  return (data as CanvasProject) ?? null;
}

export async function getCanvasWithScenes(actor: CanvasActor, id: string): Promise<{ canvas: CanvasProject; scenes: CanvasScene[] }> {
  const canvas = await getCanvas(id);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  if (!canActorAccess(actor, canvas)) throw new CanvasError("You don't have access to this canvas.", 403);
  const scenes = await listScenes(id);
  return { canvas, scenes };
}

export async function createCanvas(actor: CanvasActor, input: { title?: string; job_id?: string | null; project_id?: string | null }): Promise<CanvasProject> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    title: input.title?.trim() || "Untitled canvas",
    job_id: input.job_id ?? null,
    project_id: input.project_id ?? null,
    status: "draft",
    updated_at: now,
    owner_contact_id: actor.kind === "client" ? actor.contactId : null,
    created_by_staff_id: actor.kind === "staff" ? actor.staffId : null,
  };
  const { data, error } = await getSupabaseAdmin().from("canvas_projects").insert(row).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  return data as CanvasProject;
}

export async function updateCanvas(actor: CanvasActor, id: string, patch: { title?: string; status?: CanvasStatus; job_id?: string | null; project_id?: string | null }): Promise<CanvasProject> {
  const canvas = await getCanvas(id);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  // Clients can rename their draft; status changes are allowed for submit (draft→submitted).
  if (!canActorWrite(actor, canvas)) throw new CanvasError("You can't edit this canvas.", 403);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) updates.title = patch.title.trim() || "Untitled canvas";
  if (patch.job_id !== undefined) updates.job_id = patch.job_id;
  if (patch.project_id !== undefined) updates.project_id = patch.project_id;
  if (patch.status !== undefined) {
    if (actor.kind === "client" && patch.status !== "submitted") throw new CanvasError("Clients can only submit a canvas.", 403);
    updates.status = patch.status;
  }
  const { data, error } = await getSupabaseAdmin().from("canvas_projects").update(updates).eq("id", id).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  return data as CanvasProject;
}

export async function deleteCanvas(actor: CanvasActor, id: string): Promise<void> {
  const canvas = await getCanvas(id);
  if (!canvas) return;
  if (!canActorWrite(actor, canvas)) throw new CanvasError("You can't delete this canvas.", 403);
  const scenes = await listScenes(id);
  await removeCanvasMedia(scenes.flatMap((s) => [s.media_path, s.source_video_path, s.flattened_path].filter(Boolean) as string[]));
  const { error } = await getSupabaseAdmin().from("canvas_projects").delete().eq("id", id);
  if (error) throw new CanvasError(error.message, 500);
}

// ── Scenes ──────────────────────────────────────────────────────────
export async function listScenes(canvasId: string): Promise<CanvasScene[]> {
  const { data, error } = await getSupabaseAdmin().from("canvas_scenes").select("*").eq("canvas_id", canvasId).order("position", { ascending: true });
  if (error) throw new CanvasError(error.message, 500);
  return (data ?? []).map(rowToScene);
}

async function loadCanvasForWrite(actor: CanvasActor, canvasId: string): Promise<CanvasProject> {
  const canvas = await getCanvas(canvasId);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  if (!canActorWrite(actor, canvas)) throw new CanvasError("You can't edit this canvas.", 403);
  return canvas;
}

export async function addScene(actor: CanvasActor, canvasId: string, input: { media_path?: string | null; source_video_path?: string | null }): Promise<CanvasScene> {
  await loadCanvasForWrite(actor, canvasId);
  const sb = getSupabaseAdmin();
  const { data: last } = await sb.from("canvas_scenes").select("position").eq("canvas_id", canvasId).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = last ? Number(last.position) + 1 : 0;
  const { data, error } = await sb.from("canvas_scenes").insert({
    canvas_id: canvasId, position,
    media_path: input.media_path ?? null, source_video_path: input.source_video_path ?? null,
    annotations: EMPTY_ANNOTATIONS,
  }).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  await touchCanvas(canvasId);
  return rowToScene(data);
}

export async function getScene(sceneId: string): Promise<CanvasScene | null> {
  const { data, error } = await getSupabaseAdmin().from("canvas_scenes").select("*").eq("id", sceneId).maybeSingle();
  if (error) throw new CanvasError(error.message, 500);
  return data ? rowToScene(data) : null;
}

export async function updateScene(actor: CanvasActor, sceneId: string, patch: { annotations?: SceneAnnotations; media_path?: string | null; source_video_path?: string | null; flattened_path?: string | null; position?: number }): Promise<CanvasScene> {
  const scene = await getScene(sceneId);
  if (!scene) throw new CanvasError("Scene not found.", 404);
  await loadCanvasForWrite(actor, scene.canvas_id);
  const updates: Record<string, unknown> = {};
  if (patch.annotations !== undefined) updates.annotations = normalizeAnnotations(patch.annotations);
  if (patch.media_path !== undefined) updates.media_path = patch.media_path;
  if (patch.source_video_path !== undefined) updates.source_video_path = patch.source_video_path;
  if (patch.flattened_path !== undefined) updates.flattened_path = patch.flattened_path;
  if (patch.position !== undefined) updates.position = patch.position;
  if (Object.keys(updates).length === 0) return scene;
  const { data, error } = await getSupabaseAdmin().from("canvas_scenes").update(updates).eq("id", sceneId).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  await touchCanvas(scene.canvas_id);
  return rowToScene(data);
}

export async function reorderScenes(actor: CanvasActor, canvasId: string, orderedIds: string[]): Promise<void> {
  await loadCanvasForWrite(actor, canvasId);
  const sb = getSupabaseAdmin();
  await Promise.all(orderedIds.map((id, i) => sb.from("canvas_scenes").update({ position: i }).eq("id", id).eq("canvas_id", canvasId)));
  await touchCanvas(canvasId);
}

export async function deleteScene(actor: CanvasActor, sceneId: string): Promise<void> {
  const scene = await getScene(sceneId);
  if (!scene) return;
  await loadCanvasForWrite(actor, scene.canvas_id);
  await removeCanvasMedia([scene.media_path, scene.source_video_path, scene.flattened_path].filter(Boolean) as string[]);
  const { error } = await getSupabaseAdmin().from("canvas_scenes").delete().eq("id", sceneId);
  if (error) throw new CanvasError(error.message, 500);
  await touchCanvas(scene.canvas_id);
}

async function touchCanvas(canvasId: string): Promise<void> {
  await getSupabaseAdmin().from("canvas_projects").update({ updated_at: new Date().toISOString() }).eq("id", canvasId);
}

// ── Voice pins (canvas_pins holds audio + transcript; the pin itself lives in
// the scene annotations jsonb) ──────────────────────────────────────
export async function addVoicePin(actor: CanvasActor, sceneId: string, input: { client_key: string; audio_path: string }): Promise<CanvasPin> {
  const scene = await getScene(sceneId);
  if (!scene) throw new CanvasError("Scene not found.", 404);
  await loadCanvasForWrite(actor, scene.canvas_id);
  const { data, error } = await getSupabaseAdmin().from("canvas_pins").insert({
    scene_id: sceneId, client_key: input.client_key, kind: "voice", audio_path: input.audio_path, transcript_status: "pending",
  }).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  return data as CanvasPin;
}

export async function setPinTranscript(clientKey: string, transcript: string, status: "done" | "failed"): Promise<void> {
  await getSupabaseAdmin().from("canvas_pins").update({ transcript, transcript_status: status }).eq("client_key", clientKey);
}

export async function listScenePins(sceneId: string): Promise<CanvasPin[]> {
  const { data, error } = await getSupabaseAdmin().from("canvas_pins").select("*").eq("scene_id", sceneId).order("created_at", { ascending: true });
  if (error) throw new CanvasError(error.message, 500);
  return (data ?? []) as CanvasPin[];
}

// ── Submission + team review ────────────────────────────────────────
export async function submitCanvas(actor: CanvasActor, id: string, input: { bolt_summary?: unknown } = {}): Promise<CanvasProject> {
  const canvas = await getCanvas(id);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  // canActorWrite requires a client's canvas to still be a draft — blocks double submit.
  if (!canActorWrite(actor, canvas)) throw new CanvasError("This canvas can't be submitted.", 403);
  const updates: Record<string, unknown> = { status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (input.bolt_summary !== undefined) updates.bolt_summary = input.bolt_summary;
  const { data, error } = await getSupabaseAdmin().from("canvas_projects").update(updates).eq("id", id).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  return data as CanvasProject;
}

export async function listComments(actor: CanvasActor, canvasId: string): Promise<CanvasComment[]> {
  const canvas = await getCanvas(canvasId);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  if (!canActorAccess(actor, canvas)) throw new CanvasError("No access.", 403);
  const { data, error } = await getSupabaseAdmin().from("canvas_comments").select("*").eq("canvas_id", canvasId).order("created_at", { ascending: true });
  if (error) throw new CanvasError(error.message, 500);
  return (data ?? []) as CanvasComment[];
}

export async function addComment(actor: CanvasActor, canvasId: string, body: string): Promise<CanvasComment> {
  if (actor.kind !== "staff") throw new CanvasError("Only staff can comment on briefs.", 403);
  const text = body.trim();
  if (!text) throw new CanvasError("Comment can't be empty.", 400);
  const canvas = await getCanvas(canvasId);
  if (!canvas) throw new CanvasError("Canvas not found.", 404);
  const sb = getSupabaseAdmin();
  const { data: staff } = await sb.from("staff_users").select("display_name, email").eq("id", actor.staffId).maybeSingle();
  const author_name = staff?.display_name || staff?.email || "Staff";
  const { data, error } = await sb.from("canvas_comments").insert({ canvas_id: canvasId, author_staff_id: actor.staffId, author_name, body: text }).select("*").single();
  if (error) throw new CanvasError(error.message, 500);
  return data as CanvasComment;
}
