"use client";

// Right-hand slide-out panel. Renders in a portal on <body>, so it is never
// clipped by a sticky or blurred parent (the dashboard top bar). The expand
// button widens it for longer work (an email, an Executive Summary), and the
// choice is remembered per browser. Same props as the dashboard modals so a
// dialog can switch between the two.
//
// `resizable`: drag the left edge (or focus it and use the arrow keys) to set
// any width; double-click it, or press expand, to go full width. The width is
// remembered per `storageKey`, and children can read it with
// useSidePanelWidth() to add columns as the panel grows.
import * as React from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EXPAND_KEY = "cmi.sidePanel.expanded";
const MIN_WIDTH = 360;
const maxWidth = () => Math.round(window.innerWidth * 0.96);

/** The panel's current width in px (null outside a resizable SidePanel). */
const WidthContext = React.createContext<number | null>(null);
export const useSidePanelWidth = () => React.useContext(WidthContext);

/** How many columns of ~`min`px cards fit at this panel width; one when narrow. */
export function panelColumns(width: number | null, min = 260, max = 6): number {
  if (!width || width < 2 * min + 60) return 1;
  return Math.max(1, Math.min(max, Math.floor((width - 40) / min)));
}

export function SidePanel({ title, subtitle, onClose, wide, children, footer, resizable, storageKey }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Start wider (the expanded width is the same either way). */
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Let the person drag the left edge to any width. */
  resizable?: boolean;
  /** Remembers the dragged width per panel (with `resizable`). */
  storageKey?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const defaultWidth = wide ? 640 : 480;
  const [width, setWidth] = React.useState(defaultWidth);
  const [dragging, setDragging] = React.useState(false);
  const widthKey = `cmi.sidePanel.width.${storageKey ?? "default"}`;

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal needs the DOM, and the remembered width is per browser
    setMounted(true);
    try {
      if (resizable) {
        const saved = Number(window.localStorage.getItem(widthKey));
        if (saved >= MIN_WIDTH) setWidth(Math.min(saved, maxWidth()));
      } else {
        setExpanded(window.localStorage.getItem(EXPAND_KEY) === "1");
      }
    } catch { /* storage unavailable */ }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [resizable, widthKey]);

  const close = React.useCallback(() => {
    setShown(false);
    window.setTimeout(onClose, 200);
  }, [onClose]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [close]);

  // Keep a dragged width inside the window when it shrinks.
  React.useEffect(() => {
    if (!resizable) return;
    const onResize = () => setWidth((w) => Math.min(Math.max(w, MIN_WIDTH), maxWidth()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizable]);

  const saveWidth = React.useCallback((w: number) => {
    try { window.localStorage.setItem(widthKey, String(Math.round(w))); } catch { /* storage unavailable */ }
  }, [widthKey]);
  const setClamped = React.useCallback((w: number, save = true) => {
    const next = Math.min(Math.max(Math.round(w), MIN_WIDTH), maxWidth());
    setWidth(next);
    if (save) saveWidth(next);
  }, [saveWidth]);

  function toggleExpand() {
    if (resizable) {
      setClamped(width >= maxWidth() - 8 ? defaultWidth : maxWidth());
      return;
    }
    setExpanded((v) => {
      try { window.localStorage.setItem(EXPAND_KEY, v ? "0" : "1"); } catch { /* storage unavailable */ }
      return !v;
    });
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    let last = width;
    const move = (ev: PointerEvent) => { last = window.innerWidth - ev.clientX; setClamped(last, false); };
    const up = () => {
      setDragging(false);
      setClamped(last);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  function onHandleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 160 : 40;
    if (e.key === "ArrowLeft") { e.preventDefault(); setClamped(width + step); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setClamped(width - step); }
    else if (e.key === "Home") { e.preventDefault(); setClamped(maxWidth()); }
    else if (e.key === "End") { e.preventDefault(); setClamped(MIN_WIDTH); }
  }

  if (!mounted) return null;
  const isMax = resizable ? width >= maxWidth() - 8 : expanded;
  return createPortal(
    <div className="fixed inset-0 z-[100] print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("absolute inset-0 bg-black/30 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-2xl ease-out",
          dragging ? "transition-transform" : "transition-[transform,max-width,width] duration-200",
          !resizable && (expanded ? "max-w-[min(1100px,96vw)]" : wide ? "max-w-[640px]" : "max-w-[480px]"),
          shown ? "translate-x-0" : "translate-x-full",
          dragging && "select-none",
        )}
        style={resizable ? { width, maxWidth: "96vw" } : undefined}
      >
        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            aria-valuenow={width}
            aria-valuemin={MIN_WIDTH}
            tabIndex={0}
            title="Drag to resize · double-click to expand"
            onPointerDown={startDrag}
            onDoubleClick={toggleExpand}
            onKeyDown={onHandleKey}
            className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none sm:flex"
          >
            <span className={cn("h-full w-px bg-transparent transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent", dragging && "bg-accent")} />
            <span className={cn("absolute h-10 w-1.5 rounded-full bg-border transition-colors group-hover:bg-accent group-focus-visible:bg-accent", dragging && "bg-accent")} />
          </div>
        )}
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={toggleExpand} title={isMax ? "Shrink" : "Expand"} aria-label={isMax ? "Shrink panel" : "Expand panel"}
            className="hidden rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:block">
            {isMax ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={close} title="Close" aria-label="Close panel" className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <WidthContext.Provider value={resizable ? width : null}>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        </WidthContext.Provider>
        {footer && <footer className="shrink-0 border-t border-border px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
