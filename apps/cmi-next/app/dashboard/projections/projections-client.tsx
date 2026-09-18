"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { addMonths, monthOf } from "@/lib/projections/calc";
import { ACTIVE_JOB_STATUSES, PROJECTION_STATUS_META, type ProjectionBoard, type ProjectionRow, type AddableJob } from "@/lib/projections/types";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export function ProjectionsClient({ initialBoard }: { initialBoard: ProjectionBoard }) {
  const [board, setBoard] = React.useState(initialBoard);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const start = board.window[0];

  async function load(nextStart: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/projections?start=${nextStart.slice(0, 7)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load projections.");
      setBoard(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const { summary } = board;
  const windowLabel = `${monthLabel(board.window[0])} – ${monthLabel(board.window[board.window.length - 1])}`;

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Management</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Projections</h1>
            <p className="mt-1 text-sm text-muted-foreground">12-month revenue forecast · {windowLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-md border border-border">
              <button type="button" aria-label="Previous month" disabled={loading} onClick={() => void load(addMonths(start, -1))} className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" disabled={loading || start === board.currentMonth} onClick={() => void load(board.currentMonth)} className="border-x border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">This month</button>
              <button type="button" aria-label="Next month" disabled={loading} onClick={() => void load(addMonths(start, 1))} className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <Button size="sm" variant="accent" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add Jobs</Button>
          </div>
        </div>
      </div>

      <div className={cn("flex-1 space-y-4 p-4 md:p-6", loading && "opacity-60")}>
        {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tile label="12-Mo Projected" value={formatMoney(summary.projected12)} />
          <Tile label="12-Mo Actual" value={board.anyActuals ? formatMoney(summary.actual12) : "—"} sub={board.anyActuals ? undefined : "No billing recorded"} />
          <Tile label="Variance to Date" value={summary.varianceToDate === null ? "—" : formatMoney(summary.varianceToDate)} tone={summary.varianceToDate === null ? undefined : summary.varianceToDate < 0 ? "danger" : "success"} />
          <Tile label="Remaining Backlog" value={formatMoney(summary.remainingBacklog)} sub={`${formatMoney(summary.contractedBacklog, { compact: true })} contracted · ${formatMoney(summary.potentialBacklog, { compact: true })} potential`} />
          <Tile label="Beyond Window" value={formatMoney(summary.beyondBacklog)} sub={Object.keys(board.beyondTotals).length ? Object.entries(board.beyondTotals).map(([y, v]) => `${y}: ${formatMoney(v, { compact: true })}`).join(" · ") : "Nothing scheduled later"} />
          <Tile label="Projects" value={String(summary.activeProjects)} sub={`${summary.startingSoon} starting · ${summary.endingSoon} ending in 30 days`} />
        </div>

        {!board.anyActuals && board.rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No billing recorded yet, so actuals and variance are blank. They fill in once invoices are issued in CMI (drafts don&apos;t count) or external billing is imported.
          </p>
        )}

        {board.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <h2 className="font-semibold">No projects in Projections yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add jobs to forecast their remaining contract value month by month. Nothing on the job itself changes.</p>
            <Button className="mt-4" size="sm" variant="accent" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add Jobs</Button>
          </div>
        ) : (
          <Grid board={board} />
        )}
      </div>

      {adding && (
        <AddJobsModal
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); void load(start); }}
        />
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", tone === "danger" && "text-destructive", tone === "success" && "text-success")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────

function Grid({ board }: { board: ProjectionBoard }) {
  const { window, currentMonth, totals } = board;
  const beyondYears = Object.keys(board.beyondTotals).sort();
  const th = "px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const stickyCell = "sticky left-0 z-10 bg-card";

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[1400px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={cn(stickyCell, "z-20 w-[300px] min-w-[300px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground")}>Project</th>
            {window.map((m) => (
              <th key={m} className={cn(th, "min-w-[88px]", m === currentMonth && "bg-accent/10 text-accent")}>{monthLabel(m)}</th>
            ))}
            <th className={cn(th, "min-w-[96px] border-l border-border")}>Beyond</th>
            <th className={cn(th, "min-w-[104px] border-l border-border")}>12-Mo Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {board.rows.map((r) => <Row key={r.id} row={r} board={board} />)}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/40 text-xs">
          <FootRow label="Projected" cells={totals.map((t) => (t.projected ? formatMoney(t.projected, { compact: true }) : "—"))} beyond={formatMoney(beyondYears.reduce((s, y) => s + board.beyondTotals[y], 0), { compact: true })} total={formatMoney(board.summary.projected12, { compact: true })} window={window} currentMonth={currentMonth} strong />
          <FootRow label="Actual" cells={totals.map((t) => (board.anyActuals && t.month <= currentMonth ? formatMoney(t.actual, { compact: true }) : "—"))} window={window} currentMonth={currentMonth} total={board.anyActuals ? formatMoney(board.summary.actual12, { compact: true }) : "—"} />
          <tr>
            <td className={cn("sticky left-0 z-10 bg-muted px-3 py-1.5 font-medium")}>Variance</td>
            {totals.map((t) => (
              <td key={t.month} className={cn("px-2 py-1.5 text-right tabular-nums", t.month === currentMonth && "bg-accent/10", board.anyActuals && t.variance !== null && (t.variance < 0 ? "text-destructive" : "text-success"))}>
                {board.anyActuals && t.variance !== null ? formatMoney(t.variance, { compact: true }) : "—"}
              </td>
            ))}
            <td className="border-l border-border" />
            <td className="border-l border-border px-2 py-1.5 text-right tabular-nums">{board.summary.varianceToDate === null ? "—" : formatMoney(board.summary.varianceToDate, { compact: true })}</td>
          </tr>
          <FootRow label="Projects" cells={totals.map((t) => (t.projects ? String(t.projects) : "—"))} window={window} currentMonth={currentMonth} />
        </tfoot>
      </table>
    </div>
  );
}

function FootRow({ label, cells, beyond, total, window, currentMonth, strong }: { label: string; cells: string[]; beyond?: string; total?: string; window: string[]; currentMonth: string; strong?: boolean }) {
  return (
    <tr>
      <td className={cn("sticky left-0 z-10 bg-muted px-3 py-1.5 font-medium")}>{label}</td>
      {cells.map((c, i) => (
        <td key={window[i]} className={cn("px-2 py-1.5 text-right tabular-nums", strong && "font-semibold", window[i] === currentMonth && "bg-accent/10")}>{c}</td>
      ))}
      <td className="border-l border-border px-2 py-1.5 text-right tabular-nums">{beyond ?? ""}</td>
      <td className={cn("border-l border-border px-2 py-1.5 text-right tabular-nums", strong && "font-semibold")}>{total ?? ""}</td>
    </tr>
  );
}

function Row({ row, board }: { row: ProjectionRow; board: ProjectionBoard }) {
  const { window, currentMonth } = board;
  const fs = row.forecast_start ? monthOf(row.forecast_start) : null;
  const ff = row.forecast_finish ? monthOf(row.forecast_finish) : null;
  const beyondTotal = Object.values(row.beyond).reduce((s, v) => s + v, 0);
  const status = PROJECTION_STATUS_META[row.status];

  return (
    <tr className={cn("align-top", !row.include && "opacity-50")}>
      <td className="sticky left-0 z-10 w-[300px] min-w-[300px] border-r border-border bg-card px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {row.job_id ? (
              <Link href={`/dashboard/jobs/${row.job_id}/summary`} className="block truncate font-medium hover:text-accent hover:underline">{row.name}</Link>
            ) : (
              <span className="block truncate font-medium">{row.name}</span>
            )}
            <div className="truncate text-[11px] text-muted-foreground">{[row.job_number, row.client_name].filter(Boolean).join(" · ") || "Anticipated"}</div>
          </div>
          <Badge tone={status.tone} className="h-5 shrink-0 px-1.5 text-[10px]" title={row.status_overridden ? "Forecast status (overridden)" : row.job_status ? `From job: ${JOB_STATUS_META[row.job_status as JobStatus]?.label ?? row.job_status}` : undefined}>{status.label}</Badge>
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          PM {row.pms.join(", ") || "—"} · Super {row.supers.join(", ") || "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="text-muted-foreground">Remaining <span className="font-medium text-foreground tabular-nums">{formatMoney(row.remaining)}</span> of {formatMoney(row.total_revenue)}</span>
          <AllocationBadge row={row} />
        </div>
        {row.warnings.length > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-yellow-800 dark:text-warning">
            <AlertTriangle className="h-3 w-3 shrink-0" /> <span className="truncate">{row.warnings.join(" · ")}</span>
          </div>
        )}
      </td>
      {window.map((m) => {
        const cell = row.months[m];
        const inForecast = fs && ff && m >= fs && m <= ff;
        const showActual = board.anyActuals && m <= currentMonth && (cell.actual > 0 || cell.projected > 0);
        const variance = cell.actual - cell.projected;
        return (
          <td key={m} className={cn("px-2 py-2 text-right tabular-nums", inForecast && "bg-accent/[0.06]", m === currentMonth && "bg-accent/10")}>
            <div className={cn(cell.projected > 0 ? "font-medium" : "text-muted-foreground/40")}>{cell.projected > 0 ? formatMoney(cell.projected, { compact: true }) : "·"}</div>
            {showActual && (
              <div className="text-[10px] text-muted-foreground">
                act {formatMoney(cell.actual, { compact: true })}
                {cell.projected > 0 && <span className={cn("ml-1", variance < 0 ? "text-destructive" : "text-success")}>{variance >= 0 ? "+" : ""}{formatMoney(variance, { compact: true })}</span>}
              </div>
            )}
          </td>
        );
      })}
      <td className="border-l border-border px-2 py-2 text-right text-xs tabular-nums text-muted-foreground" title={Object.entries(row.beyond).map(([y, v]) => `${y}: ${formatMoney(v)}`).join("\n") || undefined}>
        {beyondTotal > 0 ? formatMoney(beyondTotal, { compact: true }) : "·"}
      </td>
      <td className="border-l border-border px-2 py-2 text-right font-medium tabular-nums">{formatMoney(row.window_projected, { compact: true })}</td>
    </tr>
  );
}

function AllocationBadge({ row }: { row: ProjectionRow }) {
  if (row.remaining <= 0) return <Badge tone="default" className="h-5 px-1.5 text-[10px]">Fully billed</Badge>;
  if (row.allocation === "balanced") return <Badge tone="success" className="h-5 px-1.5 text-[10px]">Balanced</Badge>;
  if (row.allocation === "under") return <Badge tone="warning" className="h-5 px-1.5 text-[10px]" title="Remaining revenue not yet forecast in any current or future month">{formatMoney(row.unallocated, { compact: true })} unallocated</Badge>;
  return <Badge tone="danger" className="h-5 px-1.5 text-[10px]" title="Future forecast exceeds remaining revenue">{formatMoney(-row.unallocated, { compact: true })} over</Badge>;
}

// ── Add Jobs ──────────────────────────────────────────────────────────────

function AddJobsModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [jobs, setJobs] = React.useState<AddableJob[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/projections/addable-jobs")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load jobs."); return j as AddableJob[]; })
      .then((j) => { if (alive) setJobs(j); })
      .catch((e) => { if (alive) { setJobs([]); setError((e as Error).message); } });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeCount = (jobs ?? []).filter((j) => ACTIVE_JOB_STATUSES.includes(j.status)).length;

  async function submit(body: { job_ids: string[] } | { all_active: true }) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/projections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add jobs.");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="add-jobs-title" className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="add-jobs-title" className="font-semibold">Add Jobs to Projections</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-xs text-muted-foreground">Each job&apos;s remaining contract value (contract + approved change orders − billed) is spread evenly across its projected start and completion months. Jobs aren&apos;t changed.</p>
          {error && <div role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          {jobs === null ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Every job is already in Projections.</div>
          ) : (
            <div className="space-y-1.5">
              {jobs.map((j) => (
                <label key={j.id} className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition", selected.has(j.id) ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50")}>
                  <input type="checkbox" className="mt-1" checked={selected.has(j.id)} onChange={() => toggle(j.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{j.job_name}</span>
                      <span className="shrink-0 tabular-nums text-xs">{formatMoney(j.contract_price)}</span>
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {JOB_STATUS_META[j.status as JobStatus]?.label ?? j.status}
                      {" · "}
                      {j.projected_start_date && j.projected_completion_date ? `${j.projected_start_date} → ${j.projected_completion_date}` : "No projected dates"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" disabled={busy || activeCount === 0} onClick={() => void submit({ all_active: true })} title="Active Project and Pre-Construction / Design jobs">
            Add all active jobs ({activeCount})
          </Button>
          <Button size="sm" variant="accent" disabled={busy || selected.size === 0} onClick={() => void submit({ job_ids: [...selected] })}>
            {busy ? "Adding…" : selected.size ? `Add ${selected.size} selected` : "Add selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}
