"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { monthLabel } from "@/lib/projections/calc";
import { PROJECTION_STATUS_META, type ProjectionRow } from "@/lib/projections/types";
import { formatDate } from "../jobs/job-ui";
import { ProjectionActions } from "./projection-actions";
import { ProjectionDetailBody } from "./projection-detail-body";

// Quick View: a compact summary with the Quick Features. The expand icon (or
// Edit) grows it into the full editor; "View Full Projection" opens the page.
export function ProjectionQuickView({ row, isSuperAdmin, initialExpanded = false, onClose, onChanged, onOpen }: {
  row: ProjectionRow;
  isSuperAdmin: boolean;
  initialExpanded?: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string, expanded?: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const changed = React.useCallback(() => { setRefreshKey((k) => k + 1); onChanged(); }, [onChanged]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = PROJECTION_STATUS_META[row.status];
  const next3 = Object.entries(row.months).slice(0, 3);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="quick-view-title"
        className={cn("relative z-10 flex w-full flex-col rounded-xl border border-border bg-card shadow-xl transition-[max-width]",
          expanded ? "h-[95vh] max-w-6xl" : "max-h-[95vh] max-w-[40rem]")}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Projection</div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="quick-view-title" className="truncate text-lg font-semibold">{row.name}</h2>
              <Badge tone={status.tone} className="h-5 px-1.5 text-[10px]">{status.label}</Badge>
              {!row.include && <Badge className="h-5 px-1.5 text-[10px]">Excluded</Badge>}
            </div>
            <LinkChips row={row} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label={expanded ? "Collapse" : "Expand"} title={expanded ? "Collapse" : "Expand"} onClick={() => setExpanded((v) => !v)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Quick Features */}
        <div className="border-b border-border px-5 py-2">
          <ProjectionActions row={row} variant="bar" isSuperAdmin={isSuperAdmin}
            onChanged={changed} onRemoved={onClose} onOpen={(id) => onOpen(id)} onEdit={() => setExpanded(true)} />
        </div>

        {expanded ? (
          <ProjectionDetailBody key={row.id} id={row.id} onChanged={changed} refreshKey={refreshKey} />
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              {([["Total", formatMoney(row.total_revenue)], ["Billed", row.has_actuals ? formatMoney(row.billed_to_date) : "—"], ["Remaining", formatMoney(row.remaining)]] as const).map(([l, v]) => (
                <div key={l} className="rounded-md border border-border px-2 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{l}</div>
                  <div className="font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <KV label="Client">{row.client_name ?? "—"}</KV>
              <KV label="Forecast">{formatDate(row.forecast_start)} – {formatDate(row.forecast_finish)}</KV>
              <KV label="Project Manager">{row.pms.join(", ") || "—"}</KV>
              <KV label="Superintendent">{row.supers.join(", ") || "—"}</KV>
              <KV label="Billing source">{row.actuals_source === "external" ? "External (Adaptive / QuickBooks)" : "CMI invoices"}</KV>
              <KV label="Location">{row.location.address ?? "—"}</KV>
            </dl>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next months</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {next3.map(([m, c]) => (
                  <div key={m} className="rounded-md bg-muted/50 px-2 py-1.5">
                    <div className="text-[10px] text-muted-foreground">{monthLabel(m)}</div>
                    <div className="font-medium tabular-nums">{c.projected ? formatMoney(c.projected) : "—"}</div>
                    {c.actual ? <div className="text-[10px] text-muted-foreground">act {formatMoney(c.actual, { compact: true })}</div> : null}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.remaining <= 0 ? "Fully billed." : row.allocation === "balanced" ? "Remaining revenue is fully forecast." : row.allocation === "under" ? `${formatMoney(row.unallocated)} of remaining revenue isn't forecast yet.` : `Future forecast exceeds remaining by ${formatMoney(-row.unallocated)}.`}
            </p>
            {row.warnings.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-800 dark:text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {row.warnings.join(" · ")}</div>
            )}
            {row.new_actuals && <Badge tone="info">New billing recorded — expand to review the forecast</Badge>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">{expanded ? "Show summary" : "Expand to edit"}</button>
          <Link href={`/dashboard/projections/${row.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">View Full Projection <ExternalLink className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="truncate">{children}</dd></div>;
}

// Where this projection is connected (job / deal / Pre-Con), as links.
export function LinkChips({ row }: { row: Pick<ProjectionRow, "links" | "source"> }) {
  const chip = "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
      {row.links.job && <Link href={`/dashboard/jobs/${row.links.job.id}/summary`} className={chip}>Job · {row.links.job.label} <ExternalLink className="h-3 w-3" /></Link>}
      {row.links.deal && <Link href={`/dashboard/pipeline/${row.links.deal.id}`} className={chip}>{["new_working", "contacted"].includes(row.links.deal.stage) ? "Future deal" : "Deal"} · {row.links.deal.label} <ExternalLink className="h-3 w-3" /></Link>}
      {row.links.opportunity && <Link href="/dashboard/sales?tab=opportunities" className={chip}>Pre-Con · {row.links.opportunity.label} <ExternalLink className="h-3 w-3" /></Link>}
      {!row.links.job && !row.links.deal && !row.links.opportunity && <span className="text-[11px]">Anticipated · not connected</span>}
    </div>
  );
}
