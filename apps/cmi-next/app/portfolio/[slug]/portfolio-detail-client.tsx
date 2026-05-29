"use client";

import * as React from "react";
import { Link2, Mail, X } from "lucide-react";

export function PortfolioGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = React.useState<number | null>(null);
  if (!images.length) return null;

  return (
    <>
      <div className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-6 py-5">
          {images.map((image, index) => (
            <button key={`${image}-${index}`} type="button" className="h-20 w-36 shrink-0 overflow-hidden rounded-md border border-border bg-muted" onClick={() => setActive(index)}>
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {active !== null ? (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 text-white">
          <button type="button" className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => setActive(null)} aria-label="Close gallery">
            <X className="h-5 w-5" />
          </button>
          <button type="button" className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => setActive((active - 1 + images.length) % images.length)} aria-label="Previous image">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => setActive((active + 1) % images.length)} aria-label="Next image">
            <span aria-hidden="true">›</span>
          </button>
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <img src={images[active]} alt="" className="max-h-[78vh] max-w-[86vw] rounded-md object-contain" />
            <div className="flex items-center gap-3 rounded-full bg-black px-5 py-3 text-sm">
              <span>{active + 1} / {images.length}</span>
              <span className="text-white/50">Share</span>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-white/10" onClick={() => navigator.clipboard?.writeText(window.location.href)} aria-label={`Copy ${title} link`}>
                <Link2 className="h-4 w-4" />
              </button>
              <a className="grid h-8 w-8 place-items-center rounded-full bg-white/10" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(window.location.href)}`} aria-label={`Email ${title}`}>
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
