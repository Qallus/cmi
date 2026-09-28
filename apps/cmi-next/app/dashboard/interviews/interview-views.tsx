"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, MessagesSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterviewRow } from "@/lib/interviews/data";
import { InterviewActions } from "./interview-actions";

export type ViewMode = "list" | "table" | "cards" | "calendar";

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  invited: "bg-info/15 text-info",
  scheduled: "bg-info/15 text-info",
  confirmed: "bg-info/15 text-info",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  follow_up: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  awaiting_documents: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  not_moving_forward: "bg-destructive/15 text-destructive",
  reschedule: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-destructive/15 text-destructive",
};

export const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function Status({ value }: { value: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[value] ?? "bg-muted")}>
      {pretty(value)}
    </span>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground">{value}%</span>
    </div>
  );
}

type Shared = { rows: InterviewRow[]; isSuperAdmin: boolean; onChanged: () => void };

export function InterviewList({ rows, isSuperAdmin, onChanged }: Shared) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-4 px-4 py-3 transition hover:bg-muted/40">
          <div className="min-w-0 flex-1">
            <Link href={`/dashboard/interviews/${r.id}`} className="font-medium hover:text-accent">{r.title}</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {r.company_name && <span>{r.company_name}</span>}
              {r.interviewer_name && <span>{r.interviewer_name}</span>}
              {r.scheduled_at && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{dateTime(r.scheduled_at)}</span>}
              {r.open_followups > 0 && <span className="text-amber-700 dark:text-amber-300">{r.open_followups} follow-up{r.open_followups === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <div className="hidden sm:block"><Progress value={r.progress} /></div>
          <Status value={r.status} />
          <InterviewActions row={r} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

export function InterviewTable({ rows, isSuperAdmin, onChanged }: Shared) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Interview</th>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Interviewer</th>
            <th className="px-3 py-2 font-medium">Scheduled</th>
            <th className="px-3 py-2 font-medium">Progress</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Follow-ups</th>
            <th className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border transition hover:bg-muted/40">
              <td className="px-3 py-2.5">
                <Link href={`/dashboard/interviews/${r.id}`} className="font-medium hover:text-accent">{r.title}</Link>
                {r.template_name && <div className="text-[11px] text-muted-foreground">{r.template_name}</div>}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.company_name || r.contact_name || "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.interviewer_name || "Unassigned"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{dateTime(r.scheduled_at)}</td>
              <td className="px-3 py-2.5"><Progress value={r.progress} /></td>
              <td className="px-3 py-2.5"><Status value={r.status} /></td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {r.open_followups > 0 ? <span className="text-amber-700 dark:text-amber-300">{r.open_followups} open</span> : "—"}
              </td>
              <td className="px-3 py-2.5 text-right">
                <InterviewActions row={r} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InterviewCards({ rows, isSuperAdmin, onChanged }: Shared) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-col rounded-lg border border-border bg-card p-4 transition hover:border-accent/40">
          <div className="mb-2 flex items-start justify-between gap-2">
            <Link href={`/dashboard/interviews/${r.id}`} className="min-w-0 font-medium leading-snug hover:text-accent">
              {r.title}
            </Link>
            <InterviewActions row={r} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
          </div>
          <div className="mb-3 space-y-1 text-[11px] text-muted-foreground">
            {r.company_name && <div className="truncate">{r.company_name}</div>}
            <div className="flex items-center gap-1"><User className="h-3 w-3" />{r.interviewer_name || "Unassigned"}</div>
            {r.scheduled_at && <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{dateTime(r.scheduled_at)}</div>}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <Progress value={r.progress} />
            <Status value={r.status} />
          </div>
          {r.open_followups > 0 && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {r.open_followups} open follow-up{r.open_followups === 1 ? "" : "s"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A month grid.
 *
 * Only interviews with a date can appear, so anything unscheduled is listed
 * underneath rather than dropped — a draft with no date is exactly the thing
 * you are looking for when you open a calendar.
 */
export function InterviewCalendar({ rows, isSuperAdmin, onChanged }: Shared) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // A chip in a day cell is too small to hang a menu off, so picking a day
  // lists it underneath where the full actions fit.
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  const byDay = React.useMemo(() => {
    const map = new Map<string, InterviewRow[]>();
    for (const r of rows) {
      if (!r.scheduled_at) continue;
      const key = dayKey(new Date(r.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rows]);

  const unscheduled = rows.filter((r) => !r.scheduled_at);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const todayKey = dayKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button" aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-md border border-border p-1.5 transition hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            Today
          </button>
          <button
            type="button" aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-md border border-border p-1.5 transition hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = dayKey(d);
            const items = byDay.get(key) ?? [];
            const otherMonth = d.getMonth() !== cursor.getMonth();
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[92px] border-b border-r border-border p-1.5 last:border-r-0",
                  otherMonth && "bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDay(items.length > 0 ? key : null)}
                  aria-label={`${d.toDateString()}${items.length ? `, ${items.length} interview${items.length === 1 ? "" : "s"}` : ""}`}
                  className={cn(
                  "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition",
                  selectedDay === key && "ring-2 ring-accent",
                  key === todayKey ? "bg-accent font-semibold text-accent-foreground" : otherMonth ? "text-muted-foreground/60" : "text-muted-foreground",
                )}>
                  {d.getDate()}
                </button>
                <div className="space-y-1">
                  {items.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      title={`${timeOnly(r.scheduled_at!)} · ${r.title}`}
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition hover:opacity-80",
                        STATUS_TONE[r.status] ?? "bg-muted",
                      )}
                    >
                      {timeOnly(r.scheduled_at!)} {r.company_name || r.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (byDay.get(selectedDay)?.length ?? 0) > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h4>
            <button type="button" onClick={() => setSelectedDay(null)}
              className="text-[11px] text-muted-foreground transition hover:text-foreground">
              Clear
            </button>
          </div>
          <InterviewList rows={byDay.get(selectedDay)!} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
        </div>
      )}

      {unscheduled.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5" />
            Not scheduled yet ({unscheduled.length})
          </h4>
          <InterviewList rows={unscheduled} isSuperAdmin={isSuperAdmin} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}
