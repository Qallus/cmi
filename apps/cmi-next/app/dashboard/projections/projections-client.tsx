"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileDown, Plus, Settings2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { addMonths, filterRows, monthLabel, monthOf, NO_FILTERS, summarize, type ProjectionFilters } from "@/lib/projections/calc";
import { ACTIVE_JOB_STATUSES, PROJECTION_STATUS_META, type ProjectionBoard, type ProjectionRow, type ProjectionStatus, type AddableJob } from "@/lib/projections/types";
import type { ProjectionSettings } from "@/lib/projections/data";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";
import { ProjectionDetailPanel } from "./projection-detail-panel";
import { AnticipatedModal } from "./anticipated-modal";
import { ImportActualsModal } from "./import-actuals-modal";
import { WorkloadView } from "./workload-view";

export type InitialAction = { open?: string | null; addDeal?: string | null; addOpportunity?: string | null };

export function ProjectionsClient({ initialBoard, initialSettings, initialAction }: {
  initialBoard: ProjectionBoard;
  initialSettings: ProjectionSettings;
  initialAction?: InitialAction;
}) {
  const [board, setBoard] = React.useState(initialBoard);
  const [settings, setSettings] = React.useState(initialSettings);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [anticipated, setAnticipated] = React.useState<{ mode: "manual" | "pipeline"; preselect?: { kind: "deal" | "opportunity"; id: string } | null } | null>(() =>
    initialAction?.addDeal ? { mode: "pipeline", preselect: { kind: "deal", id: initialAction.addDeal } }
    : initialAction?.addOpportunity ? { mode: "pipeline", preselect: { kind: "opportunity", id: initialAction.addOpportunity } }
    : null);
  const [importing, setImporting] = React.useState(false);
  const [menu, setMenu] = React.useState<"add" | "settings" | null>(null);
  const [view, setView] = React.useState<"grid" | "workload">("grid");
  const [filters, setFilters] = React.useState<ProjectionFilters>(NO_FILTERS);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [detailId, setDetailId] = React.useState<string | null>(initialAction?.open ?? null);
  const start = board.window[0];
  const closeDetail = React.useCallback(() => setDetailId(null), []);
  const reload = React.useCallback(() => { void load(start); }, [start]);

  // Deep links (?open= / ?add_deal= / ?add_opportunity=) are one-shot.
  React.useEffect(() => {
    if (initialAction && (initialAction.open || initialAction.addDeal || initialAction.addOpportunity)) {
      window.history.replaceState(null, "", "/dashboard/projections");
    }
  }, [initialAction]);

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

  async function saveMonth(rowId: string, month: string, amount: number, mode: "leave" | "redistribute") {
    const res = await fetch(`/api/projections/${rowId}/months`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: month.slice(0, 7), amount, mode }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Could not save.");
    setEditing(null);
    await load(start);
  }

  // Filtered view: rows, totals and tiles all follow the filters.
  const shown = React.useMemo(() => {
    const rows = filterRows(board.rows, filters, board.currentMonth);
    return { ...board, rows, ...summarize(rows, board.window, board.currentMonth, board.today) };
  }, [board, filters]);
  const people = (key: "pms" | "supers") => [...new Set(board.rows.flatMap((r) => r[key]))].sort();
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const setFilter = <K extends keyof ProjectionFilters>(k: K, v: ProjectionFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const pdfHref = `/api/projections/pdf?${new URLSearchParams({ start: start.slice(0, 7), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== "all")) }).toString()}`;

  const { summary } = shown;
  const windowLabel = `${monthLabel(board.window[0])} – ${monthLabel(board.window[board.window.length - 1])}`;
  const reviewCount = board.rows.filter((r) => r.new_actuals).length;

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
            <Button size="sm" variant="outline" onClick={() => setImporting(true)}><Upload className="h-3.5 w-3.5" /> Import Actuals</Button>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted"><FileDown className="h-3.5 w-3.5" /> PDF</a>
            <div className="relative">
              <Button size="sm" variant="outline" aria-label="Projections settings" onClick={() => setMenu((m) => (m === "settings" ? null : "settings"))}><Settings2 className="h-3.5 w-3.5" /></Button>
              {menu === "settings" && <SettingsPopover settings={settings} onClose={() => setMenu(null)} onSaved={(s) => { setSettings(s); setMenu(null); setNotice("Settings saved."); }} />}
            </div>
            <div className="relative">
              <Button size="sm" variant="accent" onClick={() => setMenu((m) => (m === "add" ? null : "add"))}><Plus className="h-3.5 w-3.5" /> Add <ChevronDown className="h-3 w-3" /></Button>
              {menu === "add" && (
                <div className="absolute right-0 top-10 z-30 w-60 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
                  <MenuItem onClick={() => { setMenu(null); setAdding(true); }} title="Jobs" sub="Forecast a job's remaining contract value" />
                  <MenuItem onClick={() => { setMenu(null); setAnticipated({ mode: "pipeline" }); }} title="From Pipeline" sub="A deal or Pre-Con opportunity" />
                  <MenuItem onClick={() => { setMenu(null); setAnticipated({ mode: "manual" }); }} title="Anticipated project" sub="Work that isn't in the system yet" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={cn("flex-1 space-y-4 p-4 md:p-6", loading && "opacity-60")}>
        {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {notice && (
          <div role="status" className="flex items-center justify-between rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
            <span>{notice}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tile label="12-Mo Projected" value={formatMoney(summary.projected12)} />
          <Tile label="12-Mo Actual" value={shown.anyActuals ? formatMoney(summary.actual12) : "—"} sub={shown.anyActuals ? undefined : "No billing recorded"} />
          <Tile label="Variance to Date" value={summary.varianceToDate === null ? "—" : formatMoney(summary.varianceToDate)} tone={summary.varianceToDate === null ? undefined : summary.varianceToDate < 0 ? "danger" : "success"} />
          <Tile label="Remaining Backlog" value={formatMoney(summary.remainingBacklog)} sub={`${formatMoney(summary.contractedBacklog, { compact: true })} contracted · ${formatMoney(summary.potentialBacklog, { compact: true })} potential`} />
          <Tile label="Beyond Window" value={formatMoney(summary.beyondBacklog)} sub={Object.keys(shown.beyondTotals).length ? Object.entries(shown.beyondTotals).map(([y, v]) => `${y}: ${formatMoney(v, { compact: true })}`).join(" · ") : "Nothing scheduled later"} />
          <Tile label="Projects" value={String(summary.activeProjects)} sub={`${summary.startingSoon} starting · ${summary.endingSoon} ending in 30 days`} />
        </div>

        {board.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border text-xs">
              {(["grid", "workload"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={cn("px-3 py-1.5 font-medium", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>{v === "grid" ? "Grid" : "Workload"}</button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-md border border-border text-xs">
              {(["all", "committed", "potential"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setFilter("scope", s)} className={cn("px-3 py-1.5 font-medium", filters.scope === s ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Combined" : s === "committed" ? "Committed" : "Potential"}
                </button>
              ))}
            </div>
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)}
              options={(Object.keys(PROJECTION_STATUS_META) as ProjectionStatus[]).map((s) => [s, PROJECTION_STATUS_META[s].label])} />
            <FilterSelect label="PM" value={filters.pm} onChange={(v) => setFilter("pm", v)} options={[...people("pms").map((n) => [n, n] as [string, string]), ["Unassigned", "Unassigned"]]} />
            <FilterSelect label="Super" value={filters.sup} onChange={(v) => setFilter("sup", v)} options={[...people("supers").map((n) => [n, n] as [string, string]), ["Unassigned", "Unassigned"]]} />
            <FilterSelect label="Allocation" value={filters.allocation} onChange={(v) => setFilter("allocation", v)} options={[["balanced", "Balanced"], ["under", "Unallocated"], ["over", "Over-forecast"]]} />
            <FilterSelect label="Show" value={filters.flag} onChange={(v) => setFilter("flag", v)}
              options={[["warnings", "Has warnings"], ["variance", "Has variance"], ["new_actuals", "New billing to review"], ["excluded", "Excluded"]]} />
            {filtered && <button type="button" onClick={() => setFilters(NO_FILTERS)} className="text-xs text-accent hover:underline">Clear filters</button>}
            {reviewCount > 0 && filters.flag !== "new_actuals" && (
              <button type="button" onClick={() => setFilter("flag", "new_actuals")} className="ml-auto"><Badge tone="info">{reviewCount} with new billing to review</Badge></button>
            )}
          </div>
        )}

        {!shown.anyActuals && board.rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No billing recorded yet, so actuals and variance are blank. They fill in once invoices are issued in CMI (drafts don&apos;t count) or external billing is entered or imported.
          </p>
        )}

        {board.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <h2 className="font-semibold">No projects in Projections yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add jobs to forecast their remaining contract value month by month, or add anticipated work from the Pipeline. Nothing on the job or deal itself changes.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" variant="accent" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add Jobs</Button>
              <Button size="sm" variant="outline" onClick={() => setAnticipated({ mode: "pipeline" })}>Add from Pipeline</Button>
            </div>
          </div>
        ) : shown.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No projects match these filters. <button type="button" className="text-accent hover:underline" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
          </div>
        ) : view === "workload" ? (
          <WorkloadView rows={shown.rows} window={board.window} currentMonth={board.currentMonth} threshold={settings.workload_threshold} />
        ) : (
          <Grid board={shown} editing={editing} onEdit={setEditing} onSaveMonth={saveMonth} onOpen={setDetailId} />
        )}
      </div>

      {adding && (
        <AddJobsModal
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); void load(start); }}
        />
      )}
      {anticipated && (
        <AnticipatedModal
          mode={anticipated.mode}
          preselect={anticipated.preselect}
          onClose={() => setAnticipated(null)}
          onCreated={(id) => { setAnticipated(null); void load(start); setDetailId(id); }}
        />
      )}
      {importing && (
        <ImportActualsModal
          projections={board.rows.map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setImporting(false)}
          onImported={(msg) => { setImporting(false); setNotice(msg); void load(start); }}
        />
      )}
      {detailId && <ProjectionDetailPanel key={detailId} id={detailId} onClose={closeDetail} onChanged={reload} onOpen={setDetailId} />}
    </div>
  );
}

function MenuItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded px-3 py-2 text-left hover:bg-muted">
      <div className="font-medium">{title}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-8 rounded-md border bg-background px-2 text-xs outline-none focus:border-accent", value ? "border-accent text-accent" : "border-border text-muted-foreground")}>
      <option value="">{label}: All</option>
      {options.map(([v, l]) => <option key={v} value={v}>{label}: {l}</option>)}
    </select>
  );
}

function SettingsPopover({ settings, onClose, onSaved }: { settings: ProjectionSettings; onClose: () => void; onSaved: (s: ProjectionSettings) => void }) {
  const [source, setSource] = React.useState(settings.default_actuals_source);
  const [threshold, setThreshold] = React.useState(String(settings.workload_threshold));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    const res = await fetch("/api/projections/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ default_actuals_source: source, workload_threshold: Number(threshold) }) });
    const json = await res.json().catch(() => ({}));
    if (res.ok) onSaved(json); else { setError(json.error ?? "Could not save."); setBusy(false); }
  }
  return (
    <div className="absolute right-0 top-10 z-30 w-72 space-y-3 rounded-md border border-border bg-card p-3 text-xs shadow-lg">
      <div className="font-semibold">Projections settings</div>
      {error && <div role="alert" className="text-destructive">{error}</div>}
      <label className="block space-y-1">
        <span className="font-medium">Default billing source for new projects</span>
        <select value={source} onChange={(e) => setSource(e.target.value as ProjectionSettings["default_actuals_source"])} className="h-8 w-full rounded-md border border-border bg-background px-2 outline-none focus:border-accent">
          <option value="cmi_invoices">CMI invoices</option>
          <option value="external">External (Adaptive / QuickBooks)</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-medium">Workload highlight at</span>
        <span className="flex items-center gap-2"><input type="number" min={1} max={50} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="h-8 w-20 rounded-md border border-border bg-background px-2 outline-none focus:border-accent" /> concurrent projects</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" disabled={busy} onClick={() => void save()}>Save</Button>
      </div>
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

function Grid({ board, ...handlers }: { board: ProjectionBoard } & GridHandlers) {
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
          {board.rows.map((r) => <Row key={r.id} row={r} board={board} {...handlers} />)}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/40 text-xs">
          <FootRow label="Projected" cells={totals.map((t) => (t.projected ? formatMoney(t.projected, { compact: true }) : "—"))} beyond={formatMoney(beyondYears.reduce((s, y) => s + board.beyondTotals[y], 0), { compact: true })} total={formatMoney(board.summary.projected12, { compact: true })} window={window} currentMonth={currentMonth} strong />
          <FootRow label="Actual" cells={totals.map((t) => (board.anyActuals && (t.month <= currentMonth || t.actual) ? formatMoney(t.actual, { compact: true }) : "—"))} window={window} currentMonth={currentMonth} total={board.anyActuals ? formatMoney(board.summary.actual12, { compact: true }) : "—"} />
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

type Editing = { rowId: string; month: string } | null;
type GridHandlers = {
  editing: Editing;
  onEdit: (e: Editing) => void;
  onSaveMonth: (rowId: string, month: string, amount: number, mode: "leave" | "redistribute") => Promise<void>;
  onOpen: (id: string) => void;
};

function Row({ row, board, editing, onEdit, onSaveMonth, onOpen }: { row: ProjectionRow; board: ProjectionBoard } & GridHandlers) {
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
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 truncate text-left font-medium hover:text-accent hover:underline" title="Open forecast details">{row.name}</button>
              {row.job_id && (
                <Link href={`/dashboard/jobs/${row.job_id}/summary`} aria-label={`Open job ${row.name}`} title="Open job" className="shrink-0 text-muted-foreground hover:text-accent"><ExternalLink className="h-3 w-3" /></Link>
              )}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {row.source === "job" ? [row.job_number, row.client_name].filter(Boolean).join(" · ")
                : [`Anticipated${row.source === "deal" ? " · Deal" : row.source === "opportunity" ? " · Pre-Con" : ""}`, row.client_name].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Badge tone={status.tone} className="h-5 shrink-0 px-1.5 text-[10px]" title={row.status_overridden ? "Forecast status (overridden)" : row.job_status ? `From job: ${JOB_STATUS_META[row.job_status as JobStatus]?.label ?? row.job_status}` : undefined}>{status.label}</Badge>
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          PM {row.pms.join(", ") || "—"} · Super {row.supers.join(", ") || "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="text-muted-foreground">Remaining <span className="font-medium text-foreground tabular-nums">{formatMoney(row.remaining)}</span> of {formatMoney(row.total_revenue)}</span>
          <AllocationBadge row={row} />
          {row.new_actuals && <button type="button" onClick={() => onOpen(row.id)}><Badge tone="info" className="h-5 px-1.5 text-[10px]">New billing — review</Badge></button>}
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
        // Started months always show actuals; later months only when billing is already recorded.
        const showActual = board.anyActuals && (cell.actual !== 0 || (m <= currentMonth && cell.projected > 0));
        const variance = cell.actual - cell.projected;
        return (
          <td key={m} className={cn("relative px-2 py-2 text-right tabular-nums", inForecast && "bg-accent/[0.06]", m === currentMonth && "bg-accent/10")}>
            {editing?.rowId === row.id && editing.month === m ? (
              <CellEditor
                initial={cell.projected}
                onCancel={() => onEdit(null)}
                onSave={(amount, mode) => onSaveMonth(row.id, m, amount, mode)}
              />
            ) : (
              <button
                type="button"
                onClick={() => onEdit({ rowId: row.id, month: m })}
                aria-label={`Edit ${row.name} forecast for ${monthLabel(m)}`}
                className={cn("-mx-1 w-[calc(100%+0.5rem)] rounded px-1 text-right hover:bg-muted hover:ring-1 hover:ring-border", cell.projected > 0 ? "font-medium" : "text-muted-foreground/40")}
              >
                {cell.projected > 0 ? formatMoney(cell.projected, { compact: true }) : "·"}
              </button>
            )}
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

// Inline month editor: type an amount, then choose whether the rest of the
// remaining revenue is redistributed or only this month changes.
function CellEditor({ initial, onCancel, onSave }: { initial: number; onCancel: () => void; onSave: (amount: number, mode: "leave" | "redistribute") => Promise<void> }) {
  const [value, setValue] = React.useState(initial ? String(initial) : "");
  const [choosing, setChoosing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const amount = value.trim() === "" ? 0 : Number(value.replace(/[$,\s]/g, ""));
  const valid = Number.isFinite(amount) && amount >= 0;

  function confirm() {
    if (!valid) { setError("Enter an amount of 0 or more."); return; }
    if (amount === initial) { onCancel(); return; }
    setChoosing(true);
  }

  async function save(mode: "leave" | "redistribute") {
    setBusy(true); setError(null);
    try { await onSave(amount, mode); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="relative">
      <input
        autoFocus
        inputMode="decimal"
        aria-label="Forecast amount"
        value={value}
        disabled={busy}
        onChange={(e) => { setValue(e.target.value); setChoosing(false); setError(null); }}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); confirm(); }
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }}
        className="h-7 w-full rounded border border-accent bg-background px-1.5 text-right text-xs outline-none ring-2 ring-ring"
      />
      {(choosing || error) && (
        <div className="absolute right-0 top-8 z-30 w-56 rounded-md border border-border bg-card p-2 text-left text-xs shadow-lg">
          {error && <div role="alert" className="mb-1.5 text-destructive">{error}</div>}
          {choosing && (
            <>
              <div className="mb-1.5 font-medium">Set to {formatMoney(amount)}. And the other months?</div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="accent" disabled={busy} onClick={() => void save("redistribute")}>Redistribute the rest</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void save("leave")}>Change only this month</Button>
                <button type="button" disabled={busy} onClick={onCancel} className="py-0.5 text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
      {!choosing && !error && (
        <div className="mt-0.5 flex justify-end gap-1 text-[10px]">
          <button type="button" onClick={confirm} className="text-accent hover:underline">OK</button>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:underline">Esc</button>
        </div>
      )}
    </div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
