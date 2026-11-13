"use client";

// The Gantt's colour scheme: each phase its own colour (default), or Tan &
// charcoal (Brandon's spec: tasks tan, critical charcoal, complete grey).
// Past due and Up next show in both, and a colour set on a task still wins.
// Remembered in this browser; every Gantt on the page follows the same choice.
import * as React from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLASSIC, PHASE_PALETTE, type ColorScheme } from "@/lib/schedules/colors";

const KEY = "cmi.sched.colors";
const EVENT = "cmi:sched-colors";

function read(): ColorScheme {
  try { return window.localStorage.getItem(KEY) === "classic" ? "classic" : "phase"; } catch { return "phase"; }
}

function subscribe(on: () => void) {
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);
  return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); };
}

export function useColorScheme(): [ColorScheme, (s: ColorScheme) => void] {
  // Server render and first paint use phase colours; the browser's choice applies right after.
  const scheme = React.useSyncExternalStore(subscribe, read, () => "phase" as ColorScheme);
  const set = React.useCallback((s: ColorScheme) => {
    try { window.localStorage.setItem(KEY, s); } catch { /* private window */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [scheme, set];
}

const OPTIONS: { value: ColorScheme; label: string; hint: string; swatches: string[] }[] = [
  { value: "phase", label: "Phase colours", hint: "Each phase its own colour", swatches: PHASE_PALETTE.slice(0, 4) as unknown as string[] },
  { value: "classic", label: "Tan & charcoal", hint: "Tasks tan, critical charcoal, complete grey", swatches: [CLASSIC.task, CLASSIC.critical, CLASSIC.complete] },
];

function Swatches({ colors }: { colors: string[] }) {
  return <span className="flex">{colors.map((c) => <span key={c} className="-ml-0.5 h-3 w-3 rounded-full border border-card first:ml-0" style={{ background: c }} />)}</span>;
}

/** "Colours" dropdown for the schedule page header. */
export function ColorSchemePicker({ className }: { className?: string }) {
  const [scheme, setScheme] = useColorScheme();
  const [open, setOpen] = React.useState(false);
  const cur = OPTIONS.find((o) => o.value === scheme) ?? OPTIONS[0];
  return (
    <div className={cn("relative", className)}>
      {/* Compact so it fits beside Package without pushing the header onto two lines. */}
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={`Gantt colours: ${cur.label}`} aria-label={`Gantt colours: ${cur.label}`} className="gap-1.5 px-2">
        <Palette className="h-3.5 w-3.5" /><Swatches colors={cur.swatches} />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="listbox" aria-label="Gantt colours" className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gantt colours</div>
            {OPTIONS.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={scheme === o.value} onClick={() => { setScheme(o.value); setOpen(false); }}
                className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50", scheme === o.value && "bg-accent/12")}>
                <Swatches colors={o.swatches} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", scheme === o.value && "font-medium text-accent")}>{o.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                </span>
                {scheme === o.value ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
              </button>
            ))}
            <p className="px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground">Past due and Up next show in both. A colour set on a task still wins.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
