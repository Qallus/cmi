"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { STAGE_META, ALL_STAGES } from "@/lib/pipeline/stages";
import type { PipelineReport } from "@/lib/pipeline/reporting";
import type { Quote } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "$0";
  return `$${Number(v).toLocaleString()}`;
}
function humanize(v: string): string {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function pctLabel(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

// Full-funnel reporting: conversion, forecast value, current stage
// distribution, loss reasons, long-lead follow-ups, and lead sources.
export function SalesReports({ report, quotes }: { report: PipelineReport; quotes: Quote[] }) {
  const s = report.pipeline_summary;
  const c = report.conversion_rates;

  // Lead-side metrics come from the quotes/leads table.
  const leadsBySource = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const q of quotes) map.set(q.source || "Unknown", (map.get(q.source || "Unknown") ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [quotes]);

  const lossEntries = Object.entries(report.loss_analysis).sort((a, b) => b[1] - a[1]);
  const lossMax = Math.max(1, ...lossEntries.map(([, n]) => n));
  const stageMax = Math.max(1, ...ALL_STAGES.map((st) => s.by_stage[st] ?? 0));

  return (
    <div className="h-full space-y-6 overflow-auto p-4 md:p-6">
      {/* Conversion funnel */}
      <Section title="Conversion rates" subtitle="Share of records that advanced from one stage to the next">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Lead → Opportunity" value={pctLabel(c.lead_to_opportunity_percent)} />
          <Tile label="Opportunity → Active Budget" value={pctLabel(c.opportunity_to_active_budget_percent)} />
          <Tile label="Active Budget → Pre-Con" value={pctLabel(c.active_budget_to_pre_construction_percent)} />
          <Tile label="Pre-Con → Active Project" value={pctLabel(c.pre_construction_to_active_project_percent)} />
        </div>
      </Section>

      {/* Value + forecast */}
      <Section title="Pipeline value & forecast">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Estimated Pipeline" value={money(s.estimated_pipeline_value)} accent />
          <Tile label="Forecast (Pre-Con)" value={money(s.forecasted_project_value)} accent />
          <Tile label="Active Contracts" value={money(s.active_contract_value)} accent />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Tile label="Leads" value={String(quotes.length)} />
          <Tile label="Opportunities" value={String(s.total_opportunities)} />
          <Tile label="Active Projects" value={String(s.active_project_count)} />
          <Tile label="Warranty" value={String(s.warranty_count)} />
          <Tile label="Long Leads" value={String(s.long_lead_count)} />
          <Tile label="Closed" value={String(s.closed_project_count)} />
        </div>
      </Section>

      {/* Current stage distribution */}
      <Section title="Current pipeline distribution" subtitle="Where opportunities stand right now">
        <div className="space-y-1.5">
          {ALL_STAGES.map((st) => {
            const n = s.by_stage[st] ?? 0;
            return (
              <div key={st} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-xs text-muted-foreground">{STAGE_META[st].label}</div>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded bg-accent/60" style={{ width: `${(n / stageMax) * 100}%` }} />
                </div>
                <div className="w-8 shrink-0 text-right text-xs font-medium">{n}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loss analysis */}
        <Section title="Lost opportunities by reason">
          {lossEntries.length === 0 ? (
            <Empty>No lost opportunities recorded yet.</Empty>
          ) : (
            <div className="space-y-1.5">
              {lossEntries.map(([reason, n]) => (
                <div key={reason} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs text-muted-foreground">{humanize(reason)}</div>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full rounded bg-destructive/50" style={{ width: `${(n / lossMax) * 100}%` }} />
                  </div>
                  <div className="w-8 shrink-0 text-right text-xs font-medium">{n}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Long-lead follow-ups */}
        <Section title="Long-lead follow-ups">
          {report.long_lead_followups.length === 0 ? (
            <Empty>No long leads in the follow-up pipeline.</Empty>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {report.long_lead_followups.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.opportunity_name}</div>
                    <div className="text-xs text-muted-foreground">{l.job_number ?? ""}{l.owner ? ` · ${l.owner}` : ""}</div>
                  </div>
                  <div className={cn("flex shrink-0 items-center gap-1 text-xs", l.overdue ? "text-destructive" : "text-muted-foreground")}>
                    {l.overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                    {l.follow_up_date ?? "No date"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Lead sources */}
      <Section title="Leads by source">
        {leadsBySource.length === 0 ? (
          <Empty>No leads yet.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {leadsBySource.map(([source, n]) => (
              <div key={source} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{source}</div>
                <div className="mt-0.5 text-sm font-semibold">{n}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", accent ? "border-accent/30 bg-accent/5" : "border-border bg-background")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}
