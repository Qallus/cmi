"use client";

import * as React from "react";
import { X, ExternalLink, Check } from "lucide-react";
import type { ProjectSelection } from "@/lib/selections/types";

function money(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function features(sel: ProjectSelection): string[] {
  if (Array.isArray(sel.features) && sel.features.length) return sel.features.map(String);
  // fall back to metadata.features if present at runtime
  const meta = (sel as unknown as { metadata?: { features?: unknown } }).metadata;
  if (meta && Array.isArray(meta.features)) return meta.features.map(String);
  return [];
}

// Branded, client-ready Selection Card shown in an expandable modal. Mirrors the
// Chrome extension's card, using the project_selections record + dashboard
// design tokens (works in light and dark).
export function SelectionCardModal({ selection, onClose }: { selection: ProjectSelection; onClose: () => void }) {
  const sel = selection;
  const price = money(sel.client_price ?? sel.price ?? sel.estimated_cost);
  const feats = features(sel);
  const gallery = (sel.gallery_urls ?? []).filter(Boolean);
  const sub = [sel.vendor_name, sel.model_number || sel.sku].filter(Boolean).join(" · ");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative z-10 my-6 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-background/70 p-1.5 text-muted-foreground backdrop-blur transition hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Featured image */}
        <div className="flex h-56 w-full items-center justify-center bg-muted/40">
          {sel.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sel.image_url} alt={sel.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}
        </div>

        <div className="p-6">
          {sel.eyebrow ? (
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{sel.eyebrow}</div>
          ) : sel.category ? (
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{sel.category}</div>
          ) : null}

          <h2 className="font-display text-2xl font-semibold leading-tight text-foreground">{sel.name}</h2>
          {sub && <div className="mt-1.5 text-sm text-muted-foreground">{sub}</div>}
          {price && <div className="mt-3 text-xl font-bold text-foreground">{price}{sel.unit ? <span className="text-sm font-medium text-muted-foreground"> / {sel.unit}</span> : null}</div>}

          {sel.description && <p className="mt-3 text-sm leading-relaxed text-foreground">{sel.description}</p>}
          {sel.long_description && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{sel.long_description}</p>}

          {feats.length > 0 && (
            <ul className="mt-4 grid gap-1.5">
              {feats.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          {gallery.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {gallery.slice(0, 8).map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g} alt="" className="h-14 w-full rounded-md border border-border object-cover" />
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
            {sel.sku && <span>SKU: <span className="text-foreground">{sel.sku}</span></span>}
            {sel.room_area_name && <span>Room: <span className="text-foreground">{sel.room_area_name}</span></span>}
            {(sel.product_url || sel.source_url) && (
              <a href={(sel.product_url || sel.source_url) as string} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                Vendor page <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
