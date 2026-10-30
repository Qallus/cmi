"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, CalendarClock, AlertTriangle, Clock, Flag, TriangleAlert, CircleCheck, Timer, Plus, Archive, Trash2, Activity, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSort, SortableTh, useRowSelection, HeaderCheckbox, RowCheckbox, SelectionBar, BarAction } from "@/components/ui/data-table";
import { AddScheduleWizard, type ScheduleSource } from "@/components/schedules/add-schedule-wizard";
import { createScheduleFromWizard } from "@/components/schedules/create-schedule";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HealthChip, TypeBadge, Progress, fmtDate, scheduleColor, VIEWS } from "@/components/schedules/shared";
import { ListView } from "@/components/schedules/views/list-view";
import { CalendarView } from "@/components/schedules/views/calendar-view";
import { BoardView } from "@/components/schedules/views/board-view";
import { ResourceView } from "@/components/schedules/views/resource-view";
import { SCHEDULE_TYPE_LABELS, HEALTH_LABELS, SCHEDULE_STATUS_LABELS, type ScheduleDraft, type ScheduleHealth, type ScheduleType } from "@/lib/schedules/types";
import type { GlobalScheduleRow, DashboardMetrics, GlobalItem } from "@/lib/schedules/data";
import type { ScheduleView } from "@/lib/schedules/types";

// A job number already ends with the job name ("26_012_26_027_Lindquist…"), so it's the whole label.
const jobLabel = (s: { job_number: string | null; job_name: string }) => s.job_number || s.job_name;

const COLUMNS = [["Schedule", "name"], ["Job", "job"], ["Type", "type"], ["Health", "health"], ["Progress", "progress"], ["Items", "items"], ["Overdue", "overdue"], ["Projected", "projected"]] as const;

// GlobalItem re-declared for the client boundary (matches lib type).
type Item = GlobalItem & { job_number?: string | null; job_name?: string | null };

const HEALTH_RANK: Record<string, number> = { on_track: 0, watch: 1, at_risk: 2, delayed: 3, critical: 4 };

export function SchedulesDashboardClient({ schedules, metrics, items, staff, jobs: jobOptions, canEdit, canManage }: {
  schedules: GlobalScheduleRow[]; metrics: DashboardMetrics; items: Item[]; staff: { id: string; name: string }[];
  jobs: { id: string; label: string }[]; canEdit: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<{ id: string; name: string; type: ScheduleType; description?: string }[]>([]);
  const [panel, setPanel] = React.useState<"status" | "health" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!wizardOpen || templates.length) return;
    fetch("/api/schedule-templates").then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, [wizardOpen, templates.length]);
  const [tab, setTab] = React.useState<"schedules" | "items">("schedules");
  const [view, setView] = React.useState<ScheduleView>("list");
  const [q, setQ] = React.useState("");
  const [jobFilter, setJobFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [healthFilter, setHealthFilter] = React.useState("");

  const jobs = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of schedules) if (s.job_id) m.set(s.job_id, jobLabel(s));
    return Array.from(m, ([id, label]) => ({ id, label }));
  }, [schedules]);

  const filteredSchedules = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return schedules.filter((s) => {
      if (jobFilter && s.job_id !== jobFilter) return false;
      if (typeFilter && s.type !== typeFilter) return false;
      if (healthFilter && s.health !== healthFilter) return false;
      if (term && !`${s.name} ${s.job_name} ${s.job_number ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [schedules, q, jobFilter, typeFilter, healthFilter]);

  const { sorted: sortedSchedules, sort } = useSort(filteredSchedules, {
    name: (s) => s.name,
    job: (s) => jobLabel(s),
    type: (s) => SCHEDULE_TYPE_LABELS[s.type] ?? s.type,
    health: (s) => HEALTH_RANK[s.health] ?? 0,
    progress: (s) => s.progress,
    items: (s) => s.item_count ?? 0,
    overdue: (s) => s.overdue_count ?? 0,
    projected: (s) => s.projected_completion || s.target_completion,
  });
  const visibleIds = React.useMemo(() => sortedSchedules.map((s) => s.id), [sortedSchedules]);
  const selection = useRowSelection(visibleIds);

  async function createFromWizard(draft: ScheduleDraft, source: ScheduleSource, jobId?: string) {
    if (!jobId) return;
    const { schedule, message } = await createScheduleFromWizard(jobId, draft, source);
    setNotice(message);
    if (!schedule) return;
    setWizardOpen(false);
    router.push(`/dashboard/jobs/${jobId}/schedule`);
  }

  // Quick actions on the selected schedules.
  async function bulk(patch: Record<string, unknown> | "delete", label: string) {
    const n = selection.count;
    if (patch === "delete" && !confirm(`Delete ${n} schedule${n === 1 ? "" : "s"} and all their items? This can't be undone. Archive keeps them instead.`)) return;
    setBusy(true);
    const results = await Promise.all(selection.list.map((id) => fetch(`/api/schedules/${id}`, patch === "delete"
      ? { method: "DELETE" }
      : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => r.ok).catch(() => false)));
    const failed = results.filter((ok) => !ok).length;
    setNotice(failed ? `${label}: ${failed} of ${results.length} failed.` : `${label}: ${results.length} schedule${results.length === 1 ? "" : "s"}.`);
    setBusy(false); setPanel(null); selection.clear();
    router.refresh();
  }

  const filteredItems = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (jobFilter && i.job_id !== jobFilter) return false;
      if (term && !`${i.title} ${i.schedule_name ?? ""} ${i.job_name ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, q, jobFilter]);

  const metricCards = [
    { label: "Active Schedules", value: metrics.active_schedules, icon: CalendarClock },
    { label: "At Risk", value: metrics.at_risk, icon: TriangleAlert },
    { label: "Delayed", value: metrics.delayed, icon: AlertTriangle },
    { label: "Due Today", value: metrics.due_today, icon: Clock },
    { label: "Due This Week", value: metrics.due_this_week, icon: Timer },
    { label: "Waiting on Client", value: metrics.waiting_client, icon: Clock },
    { label: "Waiting on Vendor", value: metrics.waiting_vendor, icon: Clock },
    { label: "Upcoming Milestones", value: metrics.upcoming_milestones, icon: Flag },
    { label: "Overdue", value: metrics.overdue, icon: AlertTriangle },
    { label: "Waiting on Inspection", value: metrics.waiting_inspection, icon: CircleCheck },
  ];

  const itemViews = VIEWS.filter((v) => ["list", "table", "calendar", "kanban", "resource"].includes(v.key));

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Operations</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Schedules</h1>
          </div>
          {canEdit ? <Button variant="accent" size="sm" onClick={() => setWizardOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Schedule</Button> : null}
        </div>
        {notice ? <div className="mt-2 flex items-center justify-between rounded-md bg-accent/10 px-3 py-1.5 text-xs text-accent"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="font-medium">Dismiss</button></div> : null}

        {/* Metric cards — single slidable row on mobile */}
        <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden [&>*]:min-w-[44%] [&>*]:shrink-0 sm:[&>*]:min-w-0">
          {metricCards.map((m) => (
            <div key={m.label} className="snap-start rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</span><m.icon className="h-4 w-4 text-accent" /></div>
              <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs + filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            {(["schedules", "items"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded px-3 py-1 text-xs font-medium capitalize transition", tab === t ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>{t}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-48 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
          </div>
          <Select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="h-8 w-44 text-sm"><option value="">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</Select>
          {tab === "schedules" ? (
            <>
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 w-40 text-sm"><option value="">All types</option>{Object.entries(SCHEDULE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              <Select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} className="h-8 w-36 text-sm"><option value="">All health</option><option value="on_track">On Track</option><option value="watch">Watch</option><option value="at_risk">At Risk</option><option value="delayed">Delayed</option><option value="critical">Critical</option></Select>
            </>
          ) : (
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {itemViews.map((v) => <button key={v.key} type="button" onClick={() => setView(v.key)} title={v.label} className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition", view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}><v.icon className="h-3.5 w-3.5" /><span className="hidden lg:inline">{v.label}</span></button>)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {tab === "schedules" ? (
          filteredSchedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No schedules match.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead className="bg-muted/40"><tr className="border-b border-border text-left">
                  {canEdit ? <HeaderCheckbox selection={selection} label="Select all schedules" /> : null}
                  {COLUMNS.map(([label, key]) => <SortableTh key={key} label={label} sortKey={key} sort={sort} />)}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {sortedSchedules.map((s) => (
                    <tr key={s.id} className={cn("hover:bg-muted/30", selection.ids.has(s.id) && "bg-accent/5")}>
                      {canEdit ? <RowCheckbox id={s.id} selection={selection} label={`Select ${s.name}`} /> : null}
                      <td className="px-3 py-2"><Link href={`/dashboard/jobs/${s.job_id}/schedule`} className="flex items-center gap-2 font-medium hover:text-accent"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: scheduleColor(s.id, s.color) }} />{s.is_master ? "★ " : ""}{s.name}</Link></td>
                      <td className="px-3 py-2 text-muted-foreground">{jobLabel(s)}</td>
                      <td className="px-3 py-2"><TypeBadge type={s.type} /></td>
                      <td className="px-3 py-2"><HealthChip health={s.health} /></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><Progress value={s.progress} className="w-16" /><span className="text-xs tabular-nums text-muted-foreground">{s.progress}%</span></div></td>
                      <td className="px-3 py-2 text-muted-foreground">{s.item_count ?? 0}{s.milestone_count ? ` · ◆${s.milestone_count}` : ""}</td>
                      <td className="px-3 py-2">{s.overdue_count ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{s.overdue_count}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.projected_completion || s.target_completion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          view === "calendar" ? <CalendarView items={filteredItems} /> :
          view === "kanban" ? <BoardView items={filteredItems} /> :
          view === "resource" ? <ResourceView items={filteredItems} /> :
          <ListView items={filteredItems} mode={view === "table" ? "table" : "list"} showSchedule />
        )}
      </div>

      {tab === "schedules" ? (
        <SelectionBar count={selection.count} noun="schedule" onClear={() => { selection.clear(); setPanel(null); }} panel={
          panel === "status" ? (
            <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 pb-2">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Set status</span>
              {(["active", "on_hold", "complete"] as const).map((st) => <button key={st} type="button" disabled={busy} onClick={() => void bulk({ status: st }, `Status set to ${SCHEDULE_STATUS_LABELS[st]}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">{SCHEDULE_STATUS_LABELS[st]}</button>)}
            </div>
          ) : panel === "health" ? (
            <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 pb-2">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Set health</span>
              {(Object.keys(HEALTH_LABELS) as ScheduleHealth[]).map((h) => <button key={h} type="button" disabled={busy} onClick={() => void bulk({ health: h }, `Health set to ${HEALTH_LABELS[h]}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">{HEALTH_LABELS[h]}</button>)}
            </div>
          ) : null
        }>
          <BarAction icon={CircleDot} label="Status" active={panel === "status"} onClick={() => setPanel((p) => (p === "status" ? null : "status"))} disabled={busy} />
          <BarAction icon={Activity} label="Health" active={panel === "health"} onClick={() => setPanel((p) => (p === "health" ? null : "health"))} disabled={busy} />
          <BarAction icon={Archive} label="Archive" onClick={() => void bulk({ status: "archived" }, "Archived")} disabled={busy} />
          {canManage ? <BarAction icon={Trash2} label="Delete" danger onClick={() => void bulk("delete", "Deleted")} disabled={busy} /> : null}
        </SelectionBar>
      ) : null}
      <AddScheduleWizard open={wizardOpen} staff={staff} templates={templates} existing={schedules} jobs={jobOptions} onClose={() => setWizardOpen(false)} onCreate={createFromWizard} />
    </div>
  );
}
