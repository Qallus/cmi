"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Scrub a chosen video and grab the current frame as a JPEG. Returns the frame
// blob plus the source video file so the scene can reference both.
export function VideoFramePicker({ file, onPick, onClose }: {
  file: File;
  onPick: (frame: Blob, sourceVideo: File) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [url] = React.useState(() => URL.createObjectURL(file));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);

  async function useFrame() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.9));
      if (!blob) throw new Error("Could not capture this frame.");
      onPick(blob, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture this frame.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Choose a frame</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} src={url} controls playsInline className="max-h-[60vh] w-full" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Scrub to the moment you want, then capture it as a scene.</p>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-destructive">{error}</span>}
            <Button variant="accent" onClick={useFrame} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Use this frame
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
