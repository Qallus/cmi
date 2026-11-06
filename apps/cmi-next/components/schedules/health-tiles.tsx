"use client";

// Schedule health tiles (Phase 2 Step 5) under the schedule's action bar:
// forecast vs baseline and contract, tasks behind, critical tasks, float on
// the finish, weather days and late selections. Click a tile for the tasks
// behind it; click a task to open it. Hide / show is remembered per person.
import * as React from "react";
import { ChevronDown, PanelTopClose, PanelTopOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStatsVisible } from "@/components/ui/page-header-bits";
import type { Health, HealthTile } from "@/lib/schedules/health";

const TONE: Record<HealthTile["tone"], string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-destructive",
  neutral: "text-foreground",
};

export function HealthTiles({ scheduleId, refreshKey, onOpenItem }: { scheduleId: string; refreshKey: unknown; onOpenItem: (id: string) => void }) {
  const { shown, toggle } = useStatsVisible("schedule-health");
  const [health, setHealth] = React.useState<Health | null>(null);
  const [open, setOpen] = React.useState<HealthTile["key"] | null>(null);
  React.useEffect(() => {
    if (!shown) return;
    let live = true;
    // A short wait so a burst of edits refetches once.
    const t = setTimeout(() => {
      fetch(`/api/schedules/${scheduleId}/health`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setHealth(d); }).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [scheduleId, refreshKey, shown]);

  const openTile = health?.tiles.find((t) => t.key === open) ?? null;
  return (
    <div className="border-b border-border bg-card px-4 py-2 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Schedule health</span>
        {health && !shown && health.issues ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">{health.issues} need a look</span> : null}
        <div className="flex-1" />
        <button type="button" onClick={toggle} aria-pressed={!shown} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          {shown ? <PanelTopClose className="h-3.5 w-3.5" /> : <PanelTopOpen className="h-3.5 w-3.5" />}{shown ? "Hide" : "Show"}
        </button>
      </div>
      {shown ? (
        <>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {(health?.tiles ?? []).map((t) => (
              <button key={t.key} type="button" disabled={!t.tasks.length} onClick={() => setOpen((o) => (o === t.key ? null : t.key))}
                className={cn("rounded-md border border-border px-2.5 py-1.5 text-left transition", t.tasks.length ? "hover:bg-muted/50" : "cursor-default", open === t.key && "border-accent bg-accent/5")}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{t.label}</span>{t.tasks.length ? <ChevronDown className={cn("h-3 w-3 transition", open === t.key && "rotate-180")} /> : null}
                </div>
                <div className={cn("text-base font-semibold tabular-nums", TONE[t.tone])}>{t.value}</div>
                {t.note ? <div className="truncate text-[10px] text-muted-foreground">{t.note}</div> : null}
              </button>
            ))}
            {!health ? <div className="col-span-full py-2 text-xs text-muted-foreground">Working out the schedule&apos;s health…</div> : null}
          </div>
          {openTile ? (
            <ul className="mt-2 max-h-56 divide-y divide-border overflow-auto rounded-md border border-border text-xs">
              {openTile.tasks.map((x) => (
                <li key={x.id}>
                  <button type="button" disabled={x.id.startsWith("weather-")} onClick={() => onOpenItem(x.id)} className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-muted/50 disabled:hover:bg-transparent">
                    <span className="font-medium">{x.title}</span>{x.detail ? <span className="text-muted-foreground">{x.detail}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
