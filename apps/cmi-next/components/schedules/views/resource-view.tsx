"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { StatusChip, fmtShort } from "../shared";
import type { ScheduleItem } from "@/lib/schedules/types";

function parse(iso?: string | null) { if (!iso) return null; const d = new Date(`${iso}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }
function overlaps(a: ScheduleItem, b: ScheduleItem) {
  const as = parse(a.start_date), ae = parse(a.end_date) ?? as, bs = parse(b.start_date), be = parse(b.end_date) ?? bs;
  if (!as || !ae || !bs || !be) return false;
  return as <= be && bs <= ae;
}

// Groups items by assignee and flags double-booking (overlapping date ranges).
export function ResourceView({ items, onOpenItem }: { items: ScheduleItem[]; onOpenItem?: (i: ScheduleItem) => void }) {
  const byPerson = React.useMemo(() => {
    const map = new Map<string, { name: string; items: ScheduleItem[] }>();
    for (const it of items) {
      const people = it.assignees.length ? it.assignees : [{ id: "unassigned", name: "Unassigned" }];
      for (const p of people) {
        if (!map.has(p.id)) map.set(p.id, { name: p.name, items: [] });
        map.get(p.id)!.items.push(it);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.name === "Unassigned" ? 1 : b.name === "Unassigned" ? -1 : a.name.localeCompare(b.name)));
  }, [items]);

  if (!byPerson.length) return <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No assigned items yet.</div>;

  return (
    <div className="space-y-3">
      {byPerson.map((person) => {
        const sorted = person.items.slice().sort((a, b) => (a.start_date ?? "") < (b.start_date ?? "") ? -1 : 1);
        const conflictIds = new Set<string>();
        for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[i].status !== "complete" && sorted[j].status !== "complete" && overlaps(sorted[i], sorted[j])) { conflictIds.add(sorted[i].id); conflictIds.add(sorted[j].id); }
        }
        return (
          <div key={person.name} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-semibold">{person.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{person.items.length} item{person.items.length === 1 ? "" : "s"}</span>
                {conflictIds.size ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive"><AlertTriangle className="h-3 w-3" /> {conflictIds.size / 2 | 0} conflict{conflictIds.size > 2 ? "s" : ""}</span> : null}
              </div>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((i) => (
                <button key={i.id} type="button" onClick={() => onOpenItem?.(i)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/30">
                  <span className="min-w-0 flex-1 truncate text-sm">{conflictIds.has(i.id) ? <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-destructive" /> : null}{i.title}</span>
                  <span className="text-xs text-muted-foreground">{i.schedule_name}</span>
                  <span className="text-xs text-muted-foreground">{fmtShort(i.start_date)} → {fmtShort(i.end_date)}</span>
                  <StatusChip status={i.status} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
