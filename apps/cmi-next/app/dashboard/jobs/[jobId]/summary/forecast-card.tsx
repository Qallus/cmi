"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { monthLabel } from "@/lib/projections/calc";
import { PROJECTION_STATUS_META } from "@/lib/projections/types";
import type { JobForecast } from "@/lib/projections/data";
import { formatDate } from "../../job-ui";

// Admin-only Projections summary for this job (rendered only when the server
// loaded a forecast — see summary/page.tsx).
export function ForecastCard({ jobId, forecast }: { jobId: string; forecast: JobForecast }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setBusy(true); setError(null);
    const res = await fetch("/api/projections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_ids: [jobId] }) });
    if (res.ok) router.refresh();
    else { setError((await res.json().catch(() => ({}))).error ?? "Could not add."); setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Forecast</div>
        {forecast.projection_id && <Link href={`/dashboard/projections?open=${forecast.projection_id}`} className="text-xs text-accent hover:underline">Open in Projections</Link>}
      </div>
      {!forecast.projection_id ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">This job isn&apos;t in Projections yet.</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void add()} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">{busy ? "Adding…" : "Add to Projections"}</button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{PROJECTION_STATUS_META[forecast.status].label}{forecast.include ? "" : " · excluded from totals"}</span>
            <span>{formatDate(forecast.forecast_start)} – {formatDate(forecast.forecast_finish)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["Total", forecast.total], ["Billed", forecast.billed], ["Remaining", forecast.remaining]] as const).map(([l, v]) => (
              <div key={l} className="rounded-md border border-border px-1 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{l}</div>
                <div className="text-xs font-semibold tabular-nums">{formatMoney(v)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs">
            {forecast.next3.map((m) => (
              <div key={m.month} className="text-center">
                <div className="text-[10px] text-muted-foreground">{monthLabel(m.month)}</div>
                <div className="tabular-nums">{m.projected ? formatMoney(m.projected, { compact: true }) : "—"}</div>
              </div>
            ))}
          </div>
          {forecast.allocation !== "balanced" && forecast.remaining > 0 && (
            <p className="text-[11px] text-yellow-800 dark:text-warning">
              {forecast.allocation === "under" ? `${formatMoney(forecast.unallocated)} of remaining revenue isn't forecast yet.` : `Forecast exceeds remaining by ${formatMoney(-forecast.unallocated)}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
