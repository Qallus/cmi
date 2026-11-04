"use client";

// Small pieces every dashboard page header shares, so they look the same
// everywhere: the live count pill beside the title, and the Hide / Show stats
// toggle for pages with stat cards.
import * as React from "react";
import { createPortal } from "react-dom";
import { PanelTopClose, PanelTopOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

/** "35 deals" beside a page title. Pass the number and the noun (singular). */
export function CountPill({ count, noun, plural, className }: { count: number; noun: string; plural?: string; className?: string }) {
  return (
    <span aria-live="polite" className={cn("inline-flex shrink-0 items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground", className)}>
      {count.toLocaleString("en-US")} {count === 1 ? noun : plural ?? `${noun}s`}
    </span>
  );
}

/** Title with an optional count pill (and anything else) on one line. */
export function TitleRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}>{children}</div>;
}

const MOBILE = "(max-width: 767px)";

/**
 * Whether a page's stat cards show. Remembered per person per page; with no
 * saved choice they're open on larger screens and collapsed on phones.
 */
export function useStatsVisible(pageKey: string) {
  const key = `cmi.stats.${pageKey}`;
  const [shown, setShown] = React.useState(true);
  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(key); } catch { /* private window */ }
    // eslint-disable-next-line -- one-time restore of the saved / device default on mount
    setShown(saved ? saved === "shown" : !window.matchMedia(MOBILE).matches);
  }, [key]);
  const toggle = React.useCallback(() => setShown((v) => {
    try { window.localStorage.setItem(key, v ? "hidden" : "shown"); } catch { /* fine */ }
    return !v;
  }), [key]);
  return { shown, toggle };
}

/** Hide stats / Show stats placed in the job toolbar (top bar, after Prints) on
 *  medium screens and up. It renders nothing until that slot exists. */
export function JobHeaderStatsToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    let frame = 0, tries = 0;
    const find = () => {
      const el = document.getElementById("job-header-actions");
      if (el) setSlot(el); else if (tries++ < 60) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!slot) return null;
  const label = shown ? "Hide the stat cards" : "Show the stat cards";
  return createPortal(
    <Tooltip label={label} side="bottom" className="inline-block">
      <button type="button" onClick={onToggle} aria-label={label} aria-pressed={!shown}
        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
        {shown ? <PanelTopClose className="h-3.5 w-3.5" /> : <PanelTopOpen className="h-3.5 w-3.5" />}
        <span className="hidden xl:inline">{shown ? "Hide stats" : "Show stats"}</span>
      </button>
    </Tooltip>,
    slot,
  );
}

/** The Hide stats / Show stats button for a page header. */
export function StatsToggle({ shown, onToggle, className }: { shown: boolean; onToggle: () => void; className?: string }) {
  const label = shown ? "Hide the stat cards" : "Show the stat cards";
  return (
    <Tooltip label={label} side="bottom" className={cn("inline-block", className)}>
      <Button variant="outline" size="sm" onClick={onToggle} aria-label={label} aria-pressed={!shown}>
        {shown ? <PanelTopClose className="h-4 w-4" /> : <PanelTopOpen className="h-4 w-4" />}
        <span className="hidden sm:inline">{shown ? "Hide stats" : "Show stats"}</span>
      </Button>
    </Tooltip>
  );
}

// For pages whose header and stat cards render on the server: wrap the page
// in <StatsProvider>, put <StatsToggleButton /> in the header actions and wrap
// the cards in <CollapsibleStats>. Same behaviour as useStatsVisible.
const StatsCtx = React.createContext<{ shown: boolean; toggle: () => void } | null>(null);

export function StatsProvider({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const value = useStatsVisible(pageKey);
  return <StatsCtx.Provider value={value}>{children}</StatsCtx.Provider>;
}
export function StatsToggleButton({ className }: { className?: string }) {
  const ctx = React.useContext(StatsCtx);
  if (!ctx) return null;
  return <StatsToggle shown={ctx.shown} onToggle={ctx.toggle} className={className} />;
}
export function CollapsibleStats({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(StatsCtx);
  return ctx && !ctx.shown ? null : <>{children}</>;
}
