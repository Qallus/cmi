"use client";

import * as React from "react";
import { cn, formatMoney } from "@/lib/utils";
import { monthLabel, workload } from "@/lib/projections/calc";
import type { ProjectionRow } from "@/lib/projections/types";

// PM / Superintendent workload: concurrent projects and forecast revenue under
// management per month. Months at or above the threshold are highlighted.
export function WorkloadView({ rows, window, currentMonth, threshold }: { rows: ProjectionRow[]; window: string[]; currentMonth: string; threshold: number }) {
  const [role, setRole] = React.useState<"pm" | "super">("pm");
  const people = workload(rows, window, role);
  const th = "px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {(["pm", "super"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={cn("px-3 py-1.5 font-medium", role === r ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
              {r === "pm" ? "Project Managers" : "Superintendents"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Projects with a forecast that month, and the revenue they carry. <span className="rounded bg-warning/20 px-1">Highlighted</span> = {threshold}+ concurrent projects.
        </p>
      </div>
      {people.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No included projects to show.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 w-[200px] min-w-[200px] bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{role === "pm" ? "Project Manager" : "Superintendent"}</th>
                {window.map((m) => <th key={m} className={cn(th, "min-w-[84px]", m === currentMonth && "bg-accent/10 text-accent")}>{monthLabel(m)}</th>)}
                <th className={cn(th, "min-w-[96px] border-l border-border")}>12-Mo Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((p) => (
                <tr key={p.name}>
                  <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2">
                    <div className={cn("font-medium", p.name === "Unassigned" && "text-muted-foreground")}>{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">Peak {p.peak} concurrent</div>
                  </td>
                  {window.map((m) => {
                    const c = p.months[m];
                    const busy = c.projects >= threshold && p.name !== "Unassigned";
                    return (
                      <td key={m} className={cn("px-2 py-2 text-right tabular-nums", m === currentMonth && "bg-accent/10", busy && "bg-warning/20")}>
                        {c.projects ? (
                          <>
                            <div className="font-medium">{c.projects} proj</div>
                            <div className="text-[10px] text-muted-foreground">{formatMoney(c.revenue, { compact: true })}</div>
                          </>
                        ) : <span className="text-muted-foreground/40">·</span>}
                      </td>
                    );
                  })}
                  <td className="border-l border-border px-2 py-2 text-right font-medium tabular-nums">{formatMoney(p.revenue, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
