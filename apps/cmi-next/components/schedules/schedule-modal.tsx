"use client";

import * as React from "react";
import { X, Maximize2, Minimize2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Branded modal shell for the schedule wizard + item editor. Fixes the old
// bottom-sheet clipping (capped height + scrollable body + pinned footer) and
// adds maximize / minimize / close. Minimizing keeps the component mounted so
// in-progress form state is preserved.
export function ScheduleModal({ open, title, onClose, children, footer }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      setMinimized(false);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  // Minimized: a compact restore bar pinned bottom-right (state is preserved).
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[70] flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
        <span className="max-w-[200px] truncate text-sm font-medium">{title}</span>
        <button type="button" onClick={() => setMinimized(false)} aria-label="Restore" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center">
      <div className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden border border-border bg-card shadow-2xl transition-all duration-200",
          shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          maximized
            ? "m-2 max-w-none rounded-2xl sm:m-4"
            : "mt-auto max-w-2xl rounded-t-2xl sm:my-auto sm:rounded-2xl",
        )}
        style={maximized ? { height: "calc(100dvh - 1rem)" } : { maxHeight: "90dvh" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-5 py-3">
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</h3>
          <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMaximized((m) => !m)} aria-label={maximized ? "Restore" : "Maximize"} className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">{maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
