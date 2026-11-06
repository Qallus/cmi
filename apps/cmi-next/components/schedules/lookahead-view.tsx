"use client";

// Three-week lookahead (Phase 2 Step 3): this week, next week and the week
// after, grouped by phase, with who's doing it and the selection it waits on.
// Internal or Client version; PDF prints the same rows on one landscape page.
import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOOKAHEAD_STATUS_LABELS, type Lookahead, type LookaheadAudience, type LookaheadRow } from "@/lib/schedules/lookahead";
import { ScheduleModal } from "./schedule-modal";
import { fmtDate } from "./shared";

type Data = { schedule: { id: string; name: string; status_date: string | null }; today: string; lookahead: Lookahead };

const STATUS_CLS: Record<LookaheadRow["status"], string> = {
  done: "text-emerald-700 dark:text-emerald-400",
  in_progress: "text-accent",
  late: "text-destructive",
  not_started: "text-muted-foreground",
};
const BAR_CLS: Record<LookaheadRow["status"], string> = {
  done: "bg-emerald-400/70",
  in_progress: "bg-accent",
  late: "bg-destructive/70",
  not_started: "bg-accent/50",
};
const dow = (iso: string) => "MTWTF"[new Date(`${iso}T12:00:00Z`).getUTCDay() - 1] ?? "";

export function LookaheadView({ scheduleId, onClose, onOpenItem }: { scheduleId: string; onClose: () => void; onOpenItem?: (id: string) => void }) {
  const [audience, setAudience] = React.useState<LookaheadAudience>("internal");
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedules/${scheduleId}/lookahead?audience=${audience}`).then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!live) return;
      if (res.ok) { setData(j); setError(null); } else setError(j.error ?? "Couldn't load the lookahead.");
    }).catch(() => { if (live) setError("Couldn't load the lookahead."); });
    return () => { live = false; };
  }, [scheduleId, audience]);

  const la = data?.lookahead;
  const client = audience === "client";
  return (
    <ScheduleModal open title={la ? `Three-week lookahead · ${fmtDate(la.from)} – ${fmtDate(la.to)}` : "Three-week lookahead"} onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Version" className="flex h-8 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            {(["internal", "client"] as const).map((a) => (
              <button key={a} type="button" role="radio" aria-checked={audience === a} onClick={() => setAudience(a)}
                className={cn("h-full rounded px-2.5 text-xs font-medium transition", audience === a ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {a === "internal" ? "Internal" : "Client"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="accent" onClick={() => window.open(`/api/schedules/${scheduleId}/lookahead/pdf?audience=${audience}`, "_blank")}><FileText className="h-3.5 w-3.5" /> PDF</Button>
        </div>
      }>
      <div className="pb-4 text-sm">
        {client ? <p className="mb-2 text-xs text-muted-foreground">Client version: client-visible tasks only, without trades or late flags, and only selections the client can see.</p> : null}
        {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
        {!data && !error ? <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : null}
        {la && !la.count ? <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-muted-foreground">Nothing is scheduled in these three weeks.</div> : null}
        {la && la.count ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Task</th>
                  {!client ? <th className="py-1 pr-2 font-semibold">Trade</th> : null}
                  <th className="py-1 pr-2 font-semibold">Start</th>
                  <th className="py-1 pr-2 font-semibold">Finish</th>
                  <th className="py-1 pr-2 font-semibold">Status</th>
                  <th className="py-1 pr-2 font-semibold">{client ? "Your decision" : "Waits on"}</th>
                  {la.weeks.map((w, n) => (
                    <th key={w.start} colSpan={5} className={cn("py-1 text-center font-semibold", "border-l border-border")}>
                      <div>{w.label}</div>
                      <div className="flex font-normal normal-case">
                        {la.days.slice(n * 5, n * 5 + 5).map((d) => (
                          <span key={d} className={cn("w-5 text-center leading-tight", d === data!.today && "font-semibold text-accent")}>{dow(d)}<br />{Number(d.slice(8))}</span>
                        ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {la.groups.map((g) => (
                  <React.Fragment key={g.phase}>
                    <tr><td colSpan={client ? 20 : 21} className="pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{g.phase}</td></tr>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="py-1 pr-2">
                          {onOpenItem ? <button type="button" onClick={() => onOpenItem(r.id)} className="text-left font-medium hover:text-accent">{r.milestone ? "◆ " : ""}{r.title}</button> : <span className="font-medium">{r.title}</span>}
                        </td>
                        {!client ? <td className="py-1 pr-2 text-muted-foreground">{r.trade ?? ""}</td> : null}
                        <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{fmtDate(r.start)}</td>
                        <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{r.milestone ? "" : fmtDate(r.finish)}</td>
                        <td className={cn("whitespace-nowrap py-1 pr-2 font-medium", STATUS_CLS[r.status])}>{LOOKAHEAD_STATUS_LABELS[r.status]}{r.status === "in_progress" && r.pct ? ` ${r.pct}%` : ""}</td>
                        <td className={cn("py-1 pr-2", r.waitsOn?.late && "font-medium text-destructive")}>
                          {r.waitsOn ? <>{r.waitsOn.name}{r.waitsOn.decided ? <span className="text-muted-foreground"> (decided)</span> : r.waitsOn.due ? <span className="text-muted-foreground"> · by {fmtDate(r.waitsOn.due)}</span> : null}</> : null}
                        </td>
                        {la.days.map((d, n) => (
                          <td key={d} className={cn("h-6 w-5 p-0", n % 5 === 0 ? "border-l border-border" : "border-l border-border/30")}>
                            {r.days.includes(n) ? (r.milestone
                              ? <div className="mx-auto h-2 w-2 rotate-45 bg-foreground" />
                              : <div className={cn("h-2.5", BAR_CLS[r.status])} />) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </ScheduleModal>
  );
}
