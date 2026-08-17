"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtShort, scheduleColor } from "../shared";
import { ITEM_STATUS_LABELS, PRIORITY_LABELS, type ScheduleItem, type ItemStatus, type SchedulePriority } from "@/lib/schedules/types";

type GroupBy = "status" | "priority";

// Canonical Kanban lanes for status (keeps the board to a scannable width; the
// full status set is still available in the item drawer).
const STATUS_LANES: ItemStatus[] = ["not_started", "scheduled", "in_progress", "waiting", "blocked", "complete"];
const STATUS_BUCKET: Record<ItemStatus, ItemStatus> = {
  not_started: "not_started", ready: "not_started", scheduled: "scheduled", confirmed: "scheduled",
  in_progress: "in_progress", waiting: "waiting", waiting_client: "waiting", waiting_vendor: "waiting",
  waiting_material: "waiting", waiting_inspection: "waiting", delayed: "blocked", blocked: "blocked",
  at_risk: "blocked", complete: "complete", cancelled: "complete",
};
const PRIORITY_LANES: SchedulePriority[] = ["critical", "urgent", "high", "normal", "low"];

export function BoardView({ items, groupBy = "status", canEdit, onOpenItem, onChange }: {
  items: ScheduleItem[]; groupBy?: GroupBy; canEdit?: boolean;
  onOpenItem?: (i: ScheduleItem) => void; onChange?: (id: string, patch: Partial<ScheduleItem>) => void;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const lanes = groupBy === "priority" ? PRIORITY_LANES : STATUS_LANES;
  const laneOf = (i: ScheduleItem) => (groupBy === "priority" ? i.priority : STATUS_BUCKET[i.status] ?? "not_started");
  const label = (l: string) => (groupBy === "priority" ? PRIORITY_LABELS[l as SchedulePriority] : ITEM_STATUS_LABELS[l as ItemStatus]);

  function drop(lane: string) {
    if (!dragId || !onChange) return;
    onChange(dragId, groupBy === "priority" ? { priority: lane as SchedulePriority } : { status: lane as ItemStatus });
    setDragId(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {lanes.map((lane) => {
        const laneItems = items.filter((i) => laneOf(i) === lane);
        return (
          <div key={lane} onDragOver={(e) => canEdit && e.preventDefault()} onDrop={() => drop(lane)} className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{label(lane)}</span><span className="rounded-full bg-muted px-1.5 text-[10px]">{laneItems.length}</span>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {laneItems.map((i) => (
                <div key={i.id} draggable={canEdit} onDragStart={() => setDragId(i.id)} onClick={() => onOpenItem?.(i)}
                  className={cn("cursor-pointer rounded-lg border border-border bg-card p-2.5 text-sm shadow-sm transition hover:border-accent/40", dragId === i.id && "opacity-50")}>
                  <div className="flex items-center gap-1.5">{i.kind === "milestone" ? <span className="text-accent">◆</span> : null}<span className="font-medium">{i.title}</span></div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {i.schedule_name ? <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: scheduleColor(i.schedule_id, i.schedule_color) }} />{i.schedule_name}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtShort(i.start_date)} → {fmtShort(i.end_date)}</div>
                  {i.assignees.length ? <div className="mt-1 truncate text-xs text-muted-foreground">{i.assignees.map((a) => a.name).join(", ")}</div> : null}
                </div>
              ))}
              {!laneItems.length ? <div className="px-1 py-4 text-center text-xs text-muted-foreground/60">—</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
