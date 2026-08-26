"use client";

import * as React from "react";
import { X, ExternalLink, Check, Maximize2, Minimize2, MessageSquare } from "lucide-react";
import type { ProjectSelection, SelectionApprovalStatus } from "@/lib/selections/types";

function money(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function features(sel: ProjectSelection): string[] {
  if (Array.isArray(sel.features) && sel.features.length) return sel.features.map(String);
  const meta = (sel as unknown as { metadata?: { features?: unknown } }).metadata;
  if (meta && Array.isArray(meta.features)) return meta.features.map(String);
  return [];
}

const STATUS_LABEL: Record<string, string> = {
  not_required: "No approval needed",
  pending: "Awaiting your approval",
  approved: "Approved",
  rejected: "Declined",
  revision_requested: "Change requested",
  approved_with_changes: "Approved with changes",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-400",
  approved: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
  approved_with_changes: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
  rejected: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  revision_requested: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  not_required: "border-border bg-muted text-muted-foreground",
};

export type SelectionDecision = {
  /** Client may act (client_approval_required && status pending). */
  canDecide: boolean;
  busy?: boolean;
  onApprove: () => void;
  onRequestChange: (comment: string) => void;
};

// Branded, client-ready Selection Card in an expandable modal. Mirrors the
// Chrome extension card, using the project_selections record + design tokens
// (light/dark). Collapsed by default: featured image + key facts. Expanded adds
// the gallery (below the image), long description, and full feature list.
export function SelectionCardModal({
  selection,
  onClose,
  decision,
}: {
  selection: ProjectSelection;
  onClose: () => void;
  decision?: SelectionDecision;
}) {
  const sel = selection;
  const [expanded, setExpanded] = React.useState(false);
  const [askChange, setAskChange] = React.useState(false);
  const [comment, setComment] = React.useState("");

  const price = money(sel.client_price ?? sel.price ?? sel.estimated_cost);
  const feats = features(sel);
  const gallery = (sel.gallery_urls ?? []).filter(Boolean);
  const sub = [sel.vendor_name, sel.model_number || sel.sku].filter(Boolean).join(" · ");
  const status = (sel.approval_status ?? "not_required") as SelectionApprovalStatus;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownFeats = expanded ? feats : feats.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative z-10 my-6 w-full max-w-[35rem] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner controls — dark scrim chip so they read on any image */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full bg-black/55 p-2 text-white shadow-md backdrop-blur transition hover:bg-black/75"
            aria-label={expanded ? "Collapse card" : "Expand card"}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/55 p-2 text-white shadow-md backdrop-blur transition hover:bg-black/75"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Featured image — taller, grows when expanded */}
        <div className={`flex w-full items-center justify-center bg-muted/40 transition-all ${expanded ? "h-80" : "h-64"}`}>
          {sel.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sel.image_url} alt={sel.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}
        </div>

        {/* Gallery — directly under the featured image, only when expanded.
            Every thumb is auto-cropped to the same square via object-cover. */}
        {expanded && gallery.length > 0 && (
          <div className="border-b border-border bg-muted/20 p-3">
            <div className="grid grid-cols-4 gap-2">
              {gallery.slice(0, 12).map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g} alt="" className="aspect-square w-full rounded-md border border-border object-cover" />
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          {sel.eyebrow ? (
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{sel.eyebrow}</div>
          ) : sel.category ? (
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{sel.category}</div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold leading-tight text-foreground">{sel.name}</h2>
            {status !== "not_required" && (
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.not_required}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
            )}
          </div>
          {sub && <div className="mt-1.5 text-sm text-muted-foreground">{sub}</div>}
          {price && (
            <div className="mt-3 text-xl font-bold text-foreground">
              {price}
              {sel.unit ? <span className="text-sm font-medium text-muted-foreground"> / {sel.unit}</span> : null}
            </div>
          )}

          {(sel.size || sel.finish || sel.colors) && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {sel.size && <><dt className="text-muted-foreground">Size</dt><dd className="text-foreground">{sel.size}</dd></>}
              {sel.finish && <><dt className="text-muted-foreground">Finish</dt><dd className="text-foreground">{sel.finish}</dd></>}
              {sel.colors && <><dt className="text-muted-foreground">Colors</dt><dd className="text-foreground">{sel.colors}</dd></>}
            </dl>
          )}

          {sel.description && <p className="mt-3 text-sm leading-relaxed text-foreground">{sel.description}</p>}
          {expanded && sel.long_description && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{sel.long_description}</p>}

          {shownFeats.length > 0 && (
            <ul className="mt-4 grid gap-1.5">
              {shownFeats.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Expand / collapse — discoverable text control */}
          {(feats.length > 4 || sel.long_description || gallery.length > 0) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              {expanded ? (
                <><Minimize2 className="h-3.5 w-3.5" /> Show less</>
              ) : (
                <><Maximize2 className="h-3.5 w-3.5" /> Show full card{gallery.length > 0 ? ` · ${gallery.length} more photo${gallery.length === 1 ? "" : "s"}` : ""}</>
              )}
            </button>
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

          {/* Client decision */}
          {decision?.canDecide && (
            <div className="mt-5 border-t border-border pt-4">
              {askChange ? (
                <div className="space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="What change would you like?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setAskChange(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-accent/40">Cancel</button>
                    <button
                      type="button"
                      disabled={!comment.trim() || decision.busy}
                      onClick={() => decision.onRequestChange(comment)}
                      className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
                    >
                      Send request
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={decision.busy}
                    onClick={decision.onApprove}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAskChange(true); setComment(""); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-5 py-2 text-sm font-semibold transition hover:border-accent/40"
                  >
                    <MessageSquare className="h-4 w-4" /> Not interested / request change
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
