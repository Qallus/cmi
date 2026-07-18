"use client";

import * as React from "react";
import { Camera, ChevronLeft, ChevronRight, ImageIcon, Loader2, Plus, Trash2, Video } from "lucide-react";
import { VideoFramePicker } from "./video-frame-picker";
import type { CanvasStore } from "./use-canvas-store";

export function SceneStrip({ store }: { store: CanvasStore }) {
  const { scenes, activeSceneId, mediaUrls, ensureMediaUrl, readOnly } = store;
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);

  React.useEffect(() => { scenes.forEach((s) => ensureMediaUrl(s.media_path)); }, [scenes, ensureMediaUrl]);

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await store.addSceneFromUpload(file, file.name || "photo.jpg");
  }
  function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setVideoFile(file);
  }

  function move(id: string, dir: -1 | 1) {
    const order = scenes.map((s) => s.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void store.reorder(order);
  }

  return (
    <div className="flex items-center gap-3 rounded-b-xl border border-t-0 border-border bg-card px-3 py-3 shadow-sm">
      <div className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground sm:block">Scenes</div>

      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {scenes.map((s, i) => {
          const on = s.id === activeSceneId;
          const url = s.media_path ? mediaUrls[s.media_path] : null;
          return (
            <div key={s.id} className={`group relative h-14 w-[88px] shrink-0 overflow-hidden rounded-lg border-2 ${on ? "border-accent" : "border-transparent"}`}>
              <button type="button" onClick={() => store.setActiveScene(s.id)} className="h-full w-full bg-muted">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Scene ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {s.media_path ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  </span>
                )}
              </button>
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-white">{String(i + 1).padStart(2, "0")}</span>
              {!readOnly && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" aria-label="Move left" onClick={() => move(s.id, -1)} disabled={i === 0} className="text-white/90 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete scene" onClick={() => { if (confirm("Delete this scene?")) void store.deleteScene(s.id); }} className="text-white/90 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  <button type="button" aria-label="Move right" onClick={() => move(s.id, 1)} disabled={i === scenes.length - 1} className="text-white/90 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <button type="button" onClick={() => uploadRef.current?.click()} disabled={store.busy}
            className="flex h-14 w-[88px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-[10px] font-semibold text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-50">
            {store.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <CaptureBtn icon={Camera} label="Camera" onClick={() => cameraRef.current?.click()} />
          <CaptureBtn icon={Video} label="Video" onClick={() => videoRef.current?.click()} />
          <CaptureBtn icon={ImageIcon} label="Upload" onClick={() => uploadRef.current?.click()} />
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onImage} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onImage} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={onVideo} />

      {videoFile && (
        <VideoFramePicker
          file={videoFile}
          onClose={() => setVideoFile(null)}
          onPick={async (frame, sourceVideo) => {
            setVideoFile(null);
            await store.addSceneFromUpload(frame, "frame.jpg", { blob: sourceVideo, filename: sourceVideo.name || "video.mp4" });
          }}
        />
      )}
    </div>
  );
}

function CaptureBtn({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-accent/50 hover:text-foreground">
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}
