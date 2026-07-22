"use client";

import * as React from "react";
import * as api from "./canvas-api";
import { flattenScene } from "@/lib/canvas/flatten";
import { CANVAS_COLORS, type CanvasColor, type CanvasProject, type CanvasScene, type SceneAnnotations } from "@/lib/canvas/types";

export type Tool = "select" | "draw" | "shape" | "pin" | "voice" | "stamp";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type Surface = "client" | "staff";

const AUTOSAVE_MS = 1200; // debounced write, well under the ≤2s target

export type CanvasStore = {
  canvas: CanvasProject | null;
  scenes: CanvasScene[];
  activeSceneId: string | null;
  activeScene: CanvasScene | null;
  tool: Tool;
  color: CanvasColor;
  saveStatus: SaveStatus;
  loading: boolean;
  error: string | null;
  busy: boolean;
  readOnly: boolean;
  mediaUrls: Record<string, string>;
  setTool: (t: Tool) => void;
  setColor: (c: CanvasColor) => void;
  setActiveScene: (id: string) => void;
  rename: (title: string) => void;
  mutateActiveAnnotations: (fn: (a: SceneAnnotations) => SceneAnnotations) => void;
  addSceneFromUpload: (file: Blob, filename: string, sourceVideo?: { blob: Blob; filename: string }) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  ensureMediaUrl: (path: string | null | undefined) => void;
  uploadVoiceNote: (clientKey: string, blob: Blob) => Promise<string | null>;
  uploadPinAttachment: (
    attachmentId: string,
    file: Blob,
    filename: string,
    kind: "image" | "audio",
  ) => Promise<{ path: string; transcript: string | null } | null>;
  submitBrief: (boltSummary?: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useCanvasStore(canvasId: string, surface: Surface): CanvasStore {
  const [canvas, setCanvas] = React.useState<CanvasProject | null>(null);
  const [scenes, setScenes] = React.useState<CanvasScene[]>([]);
  const [activeSceneId, setActiveSceneId] = React.useState<string | null>(null);
  const [tool, setTool] = React.useState<Tool>("select");
  const [color, setColor] = React.useState<CanvasColor>(CANVAS_COLORS.gold);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mediaUrls, setMediaUrls] = React.useState<Record<string, string>>({});

  const readOnly = surface === "client" && !!canvas && canvas.status !== "draft";

  // Debounced-save bookkeeping. We keep the latest annotations per scene and a
  // single timer; a status flash confirms the write.
  const annTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnn = React.useRef<{ sceneId: string; ann: SceneAnnotations } | null>(null);
  const statusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = React.useCallback(() => {
    setSaveStatus("saved");
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { canvas: c, scenes: s } = await api.apiGetCanvas(canvasId);
      setCanvas(c);
      setScenes(s);
      setActiveSceneId((prev) => prev && s.some((x) => x.id === prev) ? prev : (s[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load canvas.");
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => () => {
    if (annTimer.current) clearTimeout(annTimer.current);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const ensureMediaUrl = React.useCallback((path: string | null | undefined) => {
    if (!path) return;
    setMediaUrls((prev) => {
      if (prev[path]) return prev;
      // Resolve async, then patch the map. Kick off outside setState.
      void api.apiMediaUrl(path).then((url) => setMediaUrls((m) => ({ ...m, [path]: url }))).catch(() => {});
      return prev;
    });
  }, []);

  const flushAnnotations = React.useCallback(async () => {
    const pending = pendingAnn.current;
    if (!pending) return;
    pendingAnn.current = null;
    setSaveStatus("saving");
    try {
      await api.apiUpdateScene(canvasId, pending.sceneId, { annotations: pending.ann });
      flashSaved();
    } catch {
      setSaveStatus("error");
    }
  }, [canvasId, flashSaved]);

  const mutateActiveAnnotations = React.useCallback((fn: (a: SceneAnnotations) => SceneAnnotations) => {
    if (readOnly) return;
    setScenes((prev) => {
      const idx = prev.findIndex((s) => s.id === activeSceneId);
      if (idx < 0) return prev;
      const next = fn(prev[idx].annotations);
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], annotations: next };
      pendingAnn.current = { sceneId: copy[idx].id, ann: next };
      return copy;
    });
    setSaveStatus("saving");
    if (annTimer.current) clearTimeout(annTimer.current);
    annTimer.current = setTimeout(() => void flushAnnotations(), AUTOSAVE_MS);
  }, [activeSceneId, readOnly, flushAnnotations]);

  const rename = React.useCallback((title: string) => {
    setCanvas((prev) => (prev ? { ...prev, title } : prev));
    if (readOnly) return;
    setSaveStatus("saving");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      try { await api.apiUpdateCanvas(canvasId, { title }); flashSaved(); } catch { setSaveStatus("error"); }
    }, AUTOSAVE_MS);
  }, [canvasId, readOnly, flashSaved]);

  const addSceneFromUpload = React.useCallback(async (file: Blob, filename: string, sourceVideo?: { blob: Blob; filename: string }) => {
    setBusy(true);
    setError(null);
    try {
      const scene = await api.apiAddScene(canvasId, {});
      const mediaPath = await api.apiUploadMedia(canvasId, scene.id, file, filename);
      let sourceVideoPath: string | null = null;
      if (sourceVideo) sourceVideoPath = await api.apiUploadMedia(canvasId, scene.id, sourceVideo.blob, sourceVideo.filename, "video");
      const updated = await api.apiUpdateScene(canvasId, scene.id, { media_path: mediaPath, source_video_path: sourceVideoPath });
      setScenes((prev) => [...prev, updated]);
      setActiveSceneId(updated.id);
      ensureMediaUrl(updated.media_path);
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add scene.");
    } finally {
      setBusy(false);
    }
  }, [canvasId, ensureMediaUrl, flashSaved]);

  const deleteScene = React.useCallback(async (id: string) => {
    setBusy(true);
    try {
      await api.apiDeleteScene(canvasId, id);
      setScenes((prev) => {
        const next = prev.filter((s) => s.id !== id);
        setActiveSceneId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete scene.");
    } finally {
      setBusy(false);
    }
  }, [canvasId]);

  const reorder = React.useCallback(async (orderedIds: string[]) => {
    setScenes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds.map((id, i) => ({ ...(byId.get(id) as CanvasScene), position: i })).filter(Boolean);
    });
    try { await api.apiReorderScenes(canvasId, orderedIds); flashSaved(); } catch { setSaveStatus("error"); }
  }, [canvasId, flashSaved]);

  // Upload a voice-note blob, record the pin's audio row, and transcribe it.
  // Returns the transcript (or null on failure) so the caller can label the pin.
  const uploadVoiceNote = React.useCallback(async (clientKey: string, blob: Blob): Promise<string | null> => {
    const sceneId = activeSceneId;
    if (!sceneId) return null;
    try {
      const path = await api.apiUploadMedia(canvasId, sceneId, blob, "voice-note.webm", "audio");
      await api.apiCreateVoicePin(canvasId, sceneId, { client_key: clientKey, audio_path: path });
      const transcript = await api.apiTranscribe(path, clientKey).catch(() => "");
      return transcript || null;
    } catch {
      return null;
    }
  }, [activeSceneId, canvasId]);

  // Upload a photo or voice clip attached to a note pin. Audio reuses the voice
  // pin pipeline (row + transcription) keyed on the attachment id, so a spoken
  // attachment is transcribed into the brief just like a standalone voice pin.
  const uploadPinAttachment = React.useCallback(async (
    attachmentId: string,
    file: Blob,
    filename: string,
    kind: "image" | "audio",
  ): Promise<{ path: string; transcript: string | null } | null> => {
    const sceneId = activeSceneId;
    if (!sceneId) return null;
    try {
      const path = await api.apiUploadMedia(canvasId, sceneId, file, filename, kind === "audio" ? "audio" : "pin");
      let transcript: string | null = null;
      if (kind === "audio") {
        await api.apiCreateVoicePin(canvasId, sceneId, { client_key: attachmentId, audio_path: path }).catch(() => {});
        transcript = (await api.apiTranscribe(path, attachmentId).catch(() => "")) || null;
      }
      ensureMediaUrl(path);
      return { path, transcript };
    } catch {
      return null;
    }
  }, [activeSceneId, canvasId, ensureMediaUrl]);

  // Flatten every scene with media into a snapshot, then flip status to
  // submitted (which notifies the team server-side).
  const submitBrief = React.useCallback(async (boltSummary?: unknown): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      for (const s of scenes) {
        if (!s.media_path) continue;
        const url = mediaUrls[s.media_path] ?? await api.apiMediaUrl(s.media_path);
        const blob = await flattenScene(url, s.annotations);
        const path = await api.apiUploadMedia(canvasId, s.id, blob, "flattened.jpg", "flat");
        await api.apiUpdateScene(canvasId, s.id, { flattened_path: path });
      }
      const updated = await api.apiSubmitCanvas(canvasId, boltSummary);
      setCanvas(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your canvas.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [scenes, mediaUrls, canvasId]);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;

  return {
    canvas, scenes, activeSceneId, activeScene, tool, color, saveStatus, loading, error, busy, readOnly, mediaUrls,
    setTool, setColor, setActiveScene: setActiveSceneId, rename, mutateActiveAnnotations,
    addSceneFromUpload, deleteScene, reorder, ensureMediaUrl, uploadVoiceNote, uploadPinAttachment, submitBrief, refresh,
  };
}
