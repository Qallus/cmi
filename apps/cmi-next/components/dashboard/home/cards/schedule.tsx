"use client";

// A month at a glance with dots on busy days and the picked day's agenda, and
// a simple "what's coming" list. Arizona dates. (From Echo.)
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData, EventRow } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";
import { Empty, Frame } from "../kit";

const TZ = "America/Phoenix";
const KIND: Record<string, string> = { appointment: "bg-sky-500", meeting: "bg-violet-500", deadline: "bg-amber-500" };
const keyOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const time = (e: EventRow) => (e.allDay ? "All day" : new Date(e.startsAt).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }));
const iconBtn = "grid size-7 place-items-center rounded-md hover:bg-muted";

export function MiniCalendarCard({ data }: { data: DashboardData }) {
  const [month, setMonth] = useState(() => { const [y, m] = keyOf(new Date()).split("-").map(Number); return new Date(y, m - 1, 1); });
  const [picked, setPicked] = useState(() => keyOf(new Date()));
  const byDay = new Map<string, EventRow[]>();
  for (const e of data.calendar.month) { const k = keyOf(new Date(e.startsAt)); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = keyOf(new Date());
  const agenda = (byDay.get(picked) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Frame title={month.toLocaleDateString("en-US", { month: "long", year: "numeric" })} icon={CARDS.mini_calendar.icon} href="/dashboard/today"
      action={<span className="flex"><button type="button" className={iconBtn} onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="size-4" /></button><button type="button" className={iconBtn} onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="size-4" /></button></span>}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const k = localKey(d);
              const events = byDay.get(k) ?? [];
              const out = d.getMonth() !== month.getMonth();
              return (
                <button key={k} type="button" onClick={() => setPicked(k)} aria-pressed={picked === k}
                  className={cn("flex aspect-square flex-col items-center justify-center rounded-lg text-xs tabular-nums transition-colors hover:bg-muted",
                    out && "text-muted-foreground/50", k === today && "font-semibold text-accent", picked === k && "bg-primary text-primary-foreground hover:bg-primary")}>
                  {d.getDate()}
                  <span className="mt-0.5 flex h-1 gap-0.5">{events.slice(0, 3).map((e) => <span key={e.id} className={cn("size-1 rounded-full", picked === k ? "bg-primary-foreground" : KIND[e.kind] ?? "bg-muted-foreground")} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{new Date(`${picked}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
          {!agenda.length ? <p className="text-sm text-muted-foreground">Nothing on this day.</p> : (
            <ul className="space-y-1.5 text-sm">
              {agenda.map((e) => (
                <li key={e.id}>
                  <Link href={e.href} className="flex items-start gap-2 hover:underline">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND[e.kind] ?? "bg-muted-foreground")} />
                    <span className="min-w-0"><span className="block truncate">{e.title}</span><span className="text-xs text-muted-foreground">{time(e)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Frame>
  );
}

export function UpcomingCard({ data }: { data: DashboardData }) {
  const mine = data.calendar.upcoming.slice(0, 6);
  const company = (data.overview?.upcoming ?? []).slice(0, 6);
  return (
    <Frame title="Upcoming" icon={CARDS.upcoming.icon} href="/dashboard/bookings">
      {mine.length ? (
        <ul className="space-y-2 text-sm">
          {mine.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <li key={e.id}>
                <Link href={e.href} className="flex items-center gap-2 hover:underline">
                  <span className="w-12 shrink-0 text-center"><span className="block text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString("en-US", { timeZone: TZ, month: "short" })}</span><span className="block text-lg font-semibold leading-none">{d.toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" })}</span></span>
                  <span className={cn("h-8 w-0.5 shrink-0 rounded-full", KIND[e.kind] ?? "bg-muted-foreground")} />
                  <span className="min-w-0"><span className="block truncate font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{time(e)}{e.location ? ` · ${e.location}` : ""}</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : company.length ? (
        <ul className="space-y-2 text-sm">
          {company.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0"><span className="block truncate font-medium">{a.title}</span><span className="block truncate text-xs text-muted-foreground">{a.customerName}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.startTime).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      ) : <Empty action={<Link href="/dashboard/bookings" className="text-xs underline">Open Bookings</Link>}>Nothing coming up.</Empty>}
    </Frame>
  );
}
