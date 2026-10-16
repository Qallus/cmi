"use client";

// Right-hand slide-out panel. Renders in a portal on <body>, so it is never
// clipped by a sticky or blurred parent (the dashboard top bar). The expand
// button widens it for longer work (an email, an Executive Summary), and the
// choice is remembered per browser. Same props as the dashboard modals so a
// dialog can switch between the two.
import * as React from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EXPAND_KEY = "cmi.sidePanel.expanded";

export function SidePanel({ title, subtitle, onClose, wide, children, footer }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Start wider (the expanded width is the same either way). */
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal needs the DOM, and the remembered width is per browser
    setMounted(true);
    try { setExpanded(window.localStorage.getItem(EXPAND_KEY) === "1"); } catch { /* storage unavailable */ }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

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

  function toggleExpand() {
    setExpanded((v) => {
      try { window.localStorage.setItem(EXPAND_KEY, v ? "0" : "1"); } catch { /* storage unavailable */ }
      return !v;
    });
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("absolute inset-0 bg-black/30 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-2xl transition-[transform,max-width] duration-200 ease-out",
          expanded ? "max-w-[min(1100px,96vw)]" : wide ? "max-w-[640px]" : "max-w-[480px]",
          shown ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={toggleExpand} title={expanded ? "Shrink" : "Expand"} aria-label={expanded ? "Shrink panel" : "Expand panel"}
            className="hidden rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:block">
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={close} title="Close" aria-label="Close panel" className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-border px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
