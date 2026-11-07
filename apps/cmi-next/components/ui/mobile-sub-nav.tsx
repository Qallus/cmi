"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ListFilter, X } from "lucide-react";
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
  /** The sheet's accessible name, usually the page title (not shown; the sheet starts with its controls). */
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
export function MobileSubNavSection({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      {title ? <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3> : null}
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

export type MultiSelectGroup = { key: string; label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (values: string[]) => void };

/**
 * One full-width field holding several filters: tap to open a checkbox list
 * with a small heading per filter (e.g. Status, Type, PM). Nothing checked in a
 * group means "all" for that group.
 */
export function MobileSubNavMultiSelect({ groups, placeholder = "All filters" }: { groups: MultiSelectGroup[]; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const picked = groups.flatMap((g) => g.selected.map((v) => g.options.find((o) => o.value === v)?.label ?? v));
  const summary = picked.length === 0 ? placeholder : picked.length <= 2 ? picked.join(", ") : `${picked.slice(0, 2).join(", ")} +${picked.length - 2}`;
  return (
    <div className="w-full">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm transition", open ? "border-accent" : "border-border", picked.length ? "text-foreground" : "text-muted-foreground")}>
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-60 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-1.5 max-h-72 overflow-y-auto rounded-md border border-border bg-background p-1">
          {groups.map((g) => (
            <div key={g.key} className="py-1">
              <div className="flex items-center justify-between px-2 pb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</span>
                {g.selected.length ? <button type="button" onClick={() => g.onChange([])} className="text-[11px] text-accent hover:underline">Clear</button> : null}
              </div>
              {g.options.map((o) => {
                const on = g.selected.includes(o.value);
                return (
                  <button key={o.value} type="button" role="checkbox" aria-checked={on}
                    onClick={() => g.onChange(on ? g.selected.filter((v) => v !== o.value) : [...g.selected, o.value])}
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>{on ? <Check className="h-3 w-3" /> : null}</span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
        <div className="relative flex h-11 shrink-0 items-start justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden />
          <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
