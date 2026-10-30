"use client";

// "Schedules" on a record page (Schedule Builder): the record's own schedules,
// and schedule items anywhere that point at it. Renders nothing until the
// schedule_builder flag is on.
import * as React from "react";
import Link from "next/link";
import { CalendarClock, CornerDownRight, Plus } from "lucide-react";
import { fmtDate } from "./shared";
import type { JobSchedule, LinkType, ScheduleItem } from "@/lib/schedules/types";

type Data = { enabled: boolean; schedules: JobSchedule[]; items: (ScheduleItem & { schedule_name?: string })[] };

export function RecordSchedulesPanel({ type, id, schedulePage }: {
  type: LinkType; id: string;
  /** Where this record's own schedules live (and new ones are added), if it can have them. */
  schedulePage?: string;
}) {
  const [data, setData] = React.useState<Data | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedule-links?type=${type}&id=${id}`).then((r) => r.json()).then((d) => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; };
  }, [type, id]);
  if (!data?.enabled) return null;

  const itemHref = (i: ScheduleItem) => `/api/schedule-links/open?type=schedule&id=${i.schedule_id}`;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-accent" /> Schedules</h3>
        {schedulePage ? <Link href={schedulePage} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"><Plus className="h-3 w-3" /> {data.schedules.length ? "Open schedules" : "Add schedule"}</Link> : null}
      </div>
      {!data.schedules.length && !data.items.length ? <p className="text-xs text-muted-foreground">Nothing scheduled yet.</p> : null}
      {data.schedules.length ? (
        <ul className="space-y-1">
          {data.schedules.map((s) => (
            <li key={s.id}>
              <Link href={`${schedulePage ?? ""}?schedule=${s.id}`} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-1 truncate">{s.parent_schedule_id ? <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}{s.is_master ? "★ " : ""}{s.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{(s.item_count ?? 0) + (s.milestone_count ?? 0)} items</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {data.items.length ? (
        <>
          <div className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">On schedules</div>
          <ul className="space-y-1">
            {data.items.map((i) => (
              <li key={i.id}>
                <a href={itemHref(i)} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                  <span className="min-w-0 truncate">{i.title}<span className="ml-1.5 text-xs text-muted-foreground">{i.schedule_name}</span></span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtDate(i.start_date)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
