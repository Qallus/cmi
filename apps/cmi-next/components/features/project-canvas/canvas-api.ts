"use client";

// Thin client-side fetch helpers over the unified /api/canvas routes. The same
// routes serve both surfaces (client portal + staff dashboard); the session
// cookie decides the actor, so these helpers are surface-agnostic.
import type { CanvasProject, CanvasScene, CanvasStatus, SceneAnnotations } from "@/lib/canvas/types";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || (data as { error?: string }).error) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export async function apiListCanvases(params?: { jobId?: string; status?: string }): Promise<CanvasProject[]> {
  const qs = new URLSearchParams();
  if (params?.jobId) qs.set("jobId", params.jobId);
  if (params?.status) qs.set("status", params.status);
  const res = await fetch(`/api/canvas${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" });
  return (await json<{ canvases: CanvasProject[] }>(res)).canvases;
}

export async function apiCreateCanvas(input: { title?: string; job_id?: string | null; project_id?: string | null }): Promise<CanvasProject> {
  const res = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return (await json<{ canvas: CanvasProject }>(res)).canvas;
}

export async function apiGetCanvas(canvasId: string): Promise<{ canvas: CanvasProject; scenes: CanvasScene[] }> {
  const res = await fetch(`/api/canvas/${canvasId}`, { cache: "no-store" });
  return json<{ canvas: CanvasProject; scenes: CanvasScene[] }>(res);
}

export async function apiUpdateCanvas(canvasId: string, patch: { title?: string; status?: CanvasStatus; job_id?: string | null; project_id?: string | null }): Promise<CanvasProject> {
  const res = await fetch(`/api/canvas/${canvasId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  return (await json<{ canvas: CanvasProject }>(res)).canvas;
}

export async function apiDeleteCanvas(canvasId: string): Promise<void> {
  await json(await fetch(`/api/canvas/${canvasId}`, { method: "DELETE" }));
}

export async function apiAddScene(canvasId: string, input: { media_path?: string | null; source_video_path?: string | null }): Promise<CanvasScene> {
  const res = await fetch(`/api/canvas/${canvasId}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return (await json<{ scene: CanvasScene }>(res)).scene;
}

export async function apiUpdateScene(canvasId: string, sceneId: string, patch: { annotations?: SceneAnnotations; media_path?: string | null; source_video_path?: string | null; position?: number }): Promise<CanvasScene> {
  const res = await fetch(`/api/canvas/${canvasId}/scenes/${sceneId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  return (await json<{ scene: CanvasScene }>(res)).scene;
}

export async function apiDeleteScene(canvasId: string, sceneId: string): Promise<void> {
  await json(await fetch(`/api/canvas/${canvasId}/scenes/${sceneId}`, { method: "DELETE" }));
}

export async function apiReorderScenes(canvasId: string, order: string[]): Promise<void> {
  await json(await fetch(`/api/canvas/${canvasId}/scenes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) }));
}

export async function apiMediaUrl(path: string): Promise<string> {
  const res = await fetch("/api/canvas/media-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
  return (await json<{ url: string }>(res)).url;
}

export async function apiCreateVoicePin(canvasId: string, sceneId: string, input: { client_key: string; audio_path: string }): Promise<void> {
  await json(await fetch(`/api/canvas/${canvasId}/scenes/${sceneId}/voice`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function apiTranscribe(path: string, clientKey: string): Promise<string> {
  const res = await fetch("/api/canvas/transcribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, client_key: clientKey }),
  });
  return (await json<{ transcript: string }>(res)).transcript;
}

// Upload a blob to the private bucket via a signed upload URL, returning its
// stored path. `sub` optionally namespaces the object (e.g. "audio").
export async function apiUploadMedia(canvasId: string, sceneId: string | null, file: Blob, filename: string, sub?: string): Promise<string> {
  const urlRes = await fetch(`/api/canvas/${canvasId}/upload-url`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneId: sceneId ?? undefined, filename, sub }),
  });
  const { path, signedUrl } = await json<{ path: string; signedUrl: string; token: string }>(urlRes);
  const put = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" } });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
  return path;
}
