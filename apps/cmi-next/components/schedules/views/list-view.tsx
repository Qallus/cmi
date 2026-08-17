"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusChip, PriorityDot, Progress, fmtDate, scheduleColor } from "../shared";
import type { ScheduleItem } from "@/lib/schedules/types";

type Mode = "list" | "table" | "card";

export function ListView({ items, mode, showSchedule, onOpenItem }: { items: ScheduleItem[]; mode: Mode; showSchedule?: boolean; onOpenItem?: (i: ScheduleItem) => void }) {
  if (!items.length) return <Empty />;

  if (mode === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-muted/40"><tr className="border-b border-border text-left">
            {["Item", showSchedule ? "Schedule" : "Phase", "Status", "Start", "Finish", "Assignees", "Progress"].map((h) => <th key={h} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {items.map((i) => (
              <tr key={i.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpenItem?.(i)}>
                <td className="px-3 py-2"><div className="flex items-center gap-1.5"><PriorityDot priority={i.priority} />{i.kind === "milestone" ? <span className="text-accent">◆</span> : null}<span className={cn("font-medium", i.status === "complete" && "text-muted-foreground line-through")}>{i.title}</span></div></td>
                <td className="px-3 py-2 text-muted-foreground">{showSchedule ? i.schedule_name ?? "—" : "—"}</td>
                <td className="px-3 py-2"><StatusChip status={i.status} /></td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.start_date)}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.end_date)}</td>
                <td className="px-3 py-2 text-muted-foreground">{i.assignees.map((a) => a.name).join(", ") || "—"}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><Progress value={i.percent_complete} className="w-16" /><span className="text-xs tabular-nums text-muted-foreground">{i.percent_complete}%</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (mode === "card") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <button key={i.id} type="button" onClick={() => onOpenItem?.(i)} className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-accent/40 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">{i.kind === "milestone" ? <span className="text-accent">◆</span> : null}<span className="font-medium">{i.title}</span></div>
              <StatusChip status={i.status} />
            </div>
            {showSchedule && i.schedule_name ? <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: scheduleColor(i.schedule_id, i.schedule_color) }} />{i.schedule_name}</div> : null}
            <div className="mt-2 text-xs text-muted-foreground">{fmtDate(i.start_date)} → {fmtDate(i.end_date)}</div>
            {i.assignees.length ? <div className="mt-2 text-xs text-muted-foreground">{i.assignees.map((a) => a.name).join(", ")}</div> : null}
            <Progress value={i.percent_complete} className="mt-3" />
          </button>
        ))}
      </div>
    );
  }

  // list
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {items.map((i) => (
        <button key={i.id} type="button" onClick={() => onOpenItem?.(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30">
          <PriorityDot priority={i.priority} />
          {i.kind === "milestone" ? <span className="text-accent">◆</span> : null}
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-sm font-medium", i.status === "complete" && "text-muted-foreground line-through")}>{i.title}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showSchedule && i.schedule_name ? <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: scheduleColor(i.schedule_id, i.schedule_color) }} />{i.schedule_name}</span> : null}
              <span>{fmtDate(i.start_date)} → {fmtDate(i.end_date)}</span>
              {i.assignees.length ? <span>· {i.assignees.map((a) => a.name).join(", ")}</span> : null}
            </div>
          </div>
          <div className="hidden w-24 sm:block"><Progress value={i.percent_complete} /></div>
          <StatusChip status={i.status} />
        </button>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No schedule items yet.</div>;
}
