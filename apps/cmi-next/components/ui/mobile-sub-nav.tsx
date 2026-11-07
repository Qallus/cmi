"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phone sub-navigation: a filter button that sits at the far right of a page's
 * title row and opens a bottom sheet holding the page's views, search, filters
 * and actions. Pages keep their desktop toolbar and render the same controls in
 * the sheet, so nothing is lost on a phone; the sheet scrolls when it's long.
 *
 *   <div className="flex w-full items-start justify-between gap-3 md:w-auto">
 *     <h1>Jobs</h1>
 *     <MobileSubNav title="Jobs" activeCount={n}>
 *       <MobileSubNavSection title="View">…</MobileSubNavSection>
 *     </MobileSubNav>
 *   </div>
 *
 * The button is hidden from `hideFrom` up (default md, 768px). Its `mr-1` (and
 * `-mr-1` from md) puts it in the same column as the top bar's sign-out button
 * on pages padded px-4 md:px-6, the dashboard's usual page padding.
 */
const HIDE_FROM = { md: "md:hidden", lg: "lg:hidden" } as const;

export function MobileSubNav({ title, activeCount = 0, label = "Views, search and filters", hideFrom = "md", children }: {
  /** Sheet heading, usually the page title. */
  title: string;
  /** How many searches/filters are on; shown as a number on the button. */
  activeCount?: number;
  label?: string;
  hideFrom?: keyof typeof HIDE_FROM;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={activeCount ? `${label}, ${activeCount} on` : label} title={label}
        className={cn("relative mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card transition hover:text-foreground md:-mr-1",
          HIDE_FROM[hideFrom], open || activeCount ? "border-accent text-accent" : "border-border text-muted-foreground")}>
        <ListFilter className="h-4 w-4" />
        {activeCount ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{activeCount}</span> : null}
      </button>
      {open ? <BottomSheet title={title} onClose={() => setOpen(false)}>{children}</BottomSheet> : null}
    </>
  );
}

/** A titled group inside the sheet. */
export function MobileSubNavSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
    </section>
  );
}

/** An on/off switch with its label, for yes/no filters in the sheet (e.g. "Active only"). */
export function MobileSubNavToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex min-h-8 w-full items-center justify-between gap-2 text-left text-xs font-medium text-foreground">
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/** Slides up from the bottom, over the footer bar; tap outside, the ✕ or Escape to close. */
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [shown, setShown] = React.useState(false);
  const close = React.useCallback(() => { setShown(false); window.setTimeout(onClose, 180); }, [onClose]);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [close]);
  return createPortal(
    <div className="fixed inset-0 z-[70] print:hidden">
      <div className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cn("absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl transition-transform duration-200 ease-out", shown ? "translate-y-0" : "translate-y-full")}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={close} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
