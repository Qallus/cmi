"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Full-screen image view: the whole image at the largest size that fits the
 * screen, never cropped. Several images get previous / next (buttons or the
 * arrow keys). Close with ✕, Escape, or a click on the dark backdrop.
 */
export function ImageLightbox({ images, index: start = 0, alt = "", onClose }: {
  images: string[];
  index?: number;
  alt?: string;
  onClose: () => void;
}) {
  const [i, setI] = React.useState(start);
  const many = images.length > 1;
  const go = React.useCallback((d: number) => setI((n) => (n + d + images.length) % images.length), [images.length]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    // Capture, so Escape closes the image before any window underneath it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, go, many]);
  if (typeof document === "undefined" || !images[i]) return null;
  const btn = "grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt || "Image"} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[i]} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-2rem)] object-contain" />
      <button type="button" aria-label="Close" onClick={onClose} className={`${btn} absolute right-4 top-4`}><X className="h-5 w-5" /></button>
      {many ? (
        <>
          <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${btn} absolute left-4 top-1/2 -translate-y-1/2`}><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); go(1); }} className={`${btn} absolute right-4 top-1/2 -translate-y-1/2`}><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">{i + 1} / {images.length}</div>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
