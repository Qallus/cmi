"use client";

import * as React from "react";
import { Plus, GitBranch, Flag, Layers, CalendarClock, FileText, Star, Archive, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VIEWS, HealthChip, TypeBadge, Progress, fmtDate, scheduleColor } from "./shared";
import { GanttView } from "./views/gantt-view";
import { ListView } from "./views/list-view";
import { CalendarView } from "./views/calendar-view";
import { BoardView } from "./views/board-view";
import { ResourceView } from "./views/resource-view";
import { ItemDrawer } from "./item-drawer";
import { AddScheduleWizard, type ScheduleSource } from "./add-schedule-wizard";
import type { JobSchedule, ScheduleItem, SchedulePhase, ScheduleDependency, ScheduleView, ScheduleDraft, DependencyType, ScheduleType } from "@/lib/schedules/types";

type Staff = { id: string; name: string };
type Bundle = { schedule: JobSchedule; phases: SchedulePhase[]; items: ScheduleItem[]; dependencies: ScheduleDependency[] };
type Header = { schedule_count: number; active_count: number; overall_progress: number; health: string; projected_completion: string | null; next_milestone: { title: string; date: string | null; schedule_name: string } | null };

export function SchedulesWorkspace({ jobId, jobLabel, initialSchedules, initialHeader, staff, canEdit, canManage }: {
  jobId: string; jobLabel: string; initialSchedules: JobSchedule[]; initialHeader: Header; staff: Staff[]; canEdit: boolean; canManage: boolean;
}) {
  const [schedules, setSchedules] = React.useState<JobSchedule[]>(initialSchedules);
  const [header, setHeader] = React.useState<Header>(initialHeader);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialSchedules.slice(0, 1).map((s) => s.id)));
  const [bundles, setBundles] = React.useState<Record<string, Bundle>>({});
  const [view, setView] = React.useState<ScheduleView>("gantt");
  const [zoom, setZoom] = React.useState<"day" | "week" | "month">("week");
  const [kanbanGroup, setKanbanGroup] = React.useState<"status" | "priority">("status");
  const [showBaseline, setShowBaseline] = React.useState(false);
  const [linkMode, setLinkMode] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<ScheduleItem> | null>(null);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<{ id: string; name: string; type: ScheduleType; description?: string }[]>([]);
  const [packages, setPackages] = React.useState<{ id: string; name: string; description: string; templateIds: string[] }[]>([]);
  const [pkgMenu, setPkgMenu] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/schedule-templates").then((r) => r.json()).then((d) => { setTemplates(d.templates ?? []); setPackages(d.packages ?? []); }).catch(() => {});
  }, []);

  async function applyPackage(packageId: string) {
    setPkgMenu(false);
    if (!confirm("Apply this package? It creates several schedules with phases, items, and milestones.")) return;
    setBanner("Applying package…");
    const res = await fetch(`/api/jobs/${jobId}/schedule-packages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId }) });
    if (res.ok) { await refreshSchedules(); const d = await res.json(); if (d.created?.[0]) { setSelected(new Set([d.created[0].id])); await loadBundle(d.created[0].id); } setBanner("Package applied."); }
    else setBanner("Could not apply the package.");
  }

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);
  const primaryId = selectedIds[0] ?? null;
  const primarySchedule = schedules.find((s) => s.id === primaryId) ?? null;
  const overlay = selectedIds.length > 1;

  const loadBundle = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/schedules/${id}`);
    if (!res.ok) return;
    const b = await res.json();
    setBundles((prev) => ({ ...prev, [id]: { schedule: b.schedule, phases: b.phases, items: b.items, dependencies: b.dependencies } }));
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all(selectedIds.filter((id) => !bundles[id]).map(loadBundle));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(",")]);

  const refreshSchedules = React.useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/schedules`);
    if (res.ok) { const d = await res.json(); setSchedules(d.schedules); setHeader(d.header); }
  }, [jobId]);

  // Derived working set across selected schedules.
  const items = React.useMemo(() => selectedIds.flatMap((id) => bundles[id]?.items ?? []), [selectedIds, bundles]);
  const dependencies = React.useMemo(() => {
    const seen = new Set<string>(); const out: ScheduleDependency[] = [];
    for (const id of selectedIds) for (const d of bundles[id]?.dependencies ?? []) if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
    return out;
  }, [selectedIds, bundles]);
  const phases = overlay ? [] : (primaryId ? bundles[primaryId]?.phases ?? [] : []);

  function toggleSchedule(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return n; });
  }
  function soloSchedule(id: string) { setSelected(new Set([id])); setSelectorOpen(false); }

  // ---- item ops ----
  async function saveItem(patch: Partial<ScheduleItem>) {
    if (!primaryId && !editing?.id) return;
    if (editing?.id) {
      const res = await fetch(`/api/schedule-items/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (res.ok) { const d = await res.json(); if (d.cascaded?.length) setBanner(`${d.cascaded.length} downstream item${d.cascaded.length === 1 ? "" : "s"} shifted.`); }
    } else {
      const sid = (patch.schedule_id as string) || primaryId!;
      await fetch(`/api/schedules/${sid}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    }
    setEditing(null);
    await Promise.all(selectedIds.map(loadBundle));
    void refreshSchedules();
  }
  async function deleteItem() {
    if (!editing?.id) return;
    await fetch(`/api/schedule-items/${editing.id}`, { method: "DELETE" });
    setEditing(null);
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function ganttDates(id: string, start: string, end: string) {
    const res = await fetch(`/api/schedule-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start_date: start, end_date: end, cascade: true }) });
    if (res.ok) { const d = await res.json(); if (d.cascaded?.length) setBanner(`${d.cascaded.length} downstream item${d.cascaded.length === 1 ? "" : "s"} shifted.`); }
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function boardChange(id: string, patch: Partial<ScheduleItem>) {
    await fetch(`/api/schedule-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, cascade: false }) });
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function addDependency(sourceItemId: string, targetItemId: string, type: DependencyType = "finish_to_start", lag = 0) {
    await fetch(`/api/schedule-dependencies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, sourceItemId, targetItemId, type, lagDays: lag }) });
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function removeDependency(depId: string) {
    await fetch(`/api/schedule-dependencies/${depId}`, { method: "DELETE" });
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function addPhase() {
    if (!primaryId) return;
    const name = window.prompt("Phase name?"); if (!name) return;
    await fetch(`/api/schedules/${primaryId}/phases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await loadBundle(primaryId);
  }
  async function captureBaseline() {
    if (!primaryId) return;
    const name = window.prompt("Baseline name?", "Baseline"); if (name === null) return;
    await fetch(`/api/schedules/${primaryId}/baselines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name || "Baseline" }) });
    await loadBundle(primaryId); setShowBaseline(true); setBanner("Baseline captured.");
  }
  async function setMaster(id: string) {
    await fetch(`/api/schedules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_master: true }) });
    void refreshSchedules();
  }
  async function archiveSchedule(id: string) {
    if (!confirm("Archive this schedule? Items are kept and it can be restored later.")) return;
    await fetch(`/api/schedules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
    setSelected((prev) => { const n = new Set(prev); n.delete(id); if (!n.size && schedules[0]) n.add(schedules.find((s) => s.id !== id)?.id ?? schedules[0].id); return n; });
    void refreshSchedules();
  }

  async function createSchedule(draft: ScheduleDraft, source: ScheduleSource) {
    const res = await fetch(`/api/jobs/${jobId}/schedules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (!res.ok) { setBanner("Could not create the schedule."); return; }
    const created: JobSchedule = await res.json();
    // Copy items from an existing schedule if requested.
    if (source.mode === "copy" && source.copyFromId) {
      const src = bundles[source.copyFromId] ?? (await fetch(`/api/schedules/${source.copyFromId}`).then((r) => r.json()));
      const srcItems: ScheduleItem[] = src.items ?? [];
      for (const it of srcItems) {
        const { id: _id, schedule_id: _s, phase_id: _p, created_at: _c, updated_at: _u, ...rest } = it;
        await fetch(`/api/schedules/${created.id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rest) });
      }
    } else if (source.mode === "template" && source.templateId) {
      await fetch(`/api/schedules/${created.id}/apply-template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: source.templateId }) }).catch(() => {});
    }
    setWizardOpen(false);
    await refreshSchedules();
    setSelected(new Set([created.id]));
    await loadBundle(created.id);
  }

  const newItem = (kind: "task" | "milestone") => setEditing({ kind, schedule_id: primaryId ?? undefined, status: "not_started", priority: "normal", percent_complete: 0, all_day: true });

  return (
    <div className="flex h-full flex-col">
      {/* Header rollup */}
      <div className="border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{jobLabel}</div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Schedules</h1>
          </div>
          <Stat label="Schedules" value={String(header.schedule_count)} />
          <div className="min-w-[120px]"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Progress</div><div className="mt-1 flex items-center gap-2"><Progress value={header.overall_progress} className="w-20" /><span className="text-sm font-medium tabular-nums">{header.overall_progress}%</span></div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Health</div><div className="mt-0.5"><HealthChip health={header.health as never} /></div></div>
          <Stat label="Projected completion" value={fmtDate(header.projected_completion)} />
          {header.next_milestone ? <Stat label="Next milestone" value={`◆ ${header.next_milestone.title}`} /> : null}
          <div className="flex-1" />
          {canEdit && packages.length ? (
            <div className="relative">
              <Button size="sm" variant="outline" onClick={() => setPkgMenu((o) => !o)}><Layers className="h-3.5 w-3.5" /> Package <ChevronDown className="h-3 w-3 opacity-60" /></Button>
              {pkgMenu ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPkgMenu(false)} />
                  <div className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Job Schedule Packages</div>
                    {packages.map((p) => (
                      <button key={p.id} type="button" onClick={() => applyPackage(p.id)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted/50">
                        <div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.description}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {canEdit ? <Button size="sm" variant="accent" onClick={() => setWizardOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Schedule</Button> : null}
        </div>
      </div>

      {schedules.length === 0 ? (
        <EmptyState canEdit={canEdit} onAdd={() => setWizardOpen(true)} />
      ) : (
        <>
          {/* Toolbar: schedule selector + views + actions */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 md:px-6">
            {/* Schedule selector / overlay */}
            <div className="relative">
              <button type="button" onClick={() => setSelectorOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedIds.length === 1 ? (primarySchedule?.name ?? "Schedule") : `${selectedIds.length} schedules`}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              {selectorOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
                  <div className="absolute left-0 z-50 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Overlay schedules</div>
                    {schedules.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSchedule(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: scheduleColor(s.id, s.color) }} />
                        <button type="button" onClick={() => soloSchedule(s.id)} className="min-w-0 flex-1 truncate text-left text-sm">{s.is_master ? "★ " : ""}{s.name}</button>
                        <span className="text-[10px] text-muted-foreground">{s.item_count ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {primarySchedule ? <TypeBadge type={primarySchedule.type} /> : null}
            {primarySchedule?.is_master ? <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"><Star className="h-3 w-3" /> Master</span> : null}

            <div className="flex-1" />

            {/* View switcher */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" onClick={() => setView(v.key)} title={v.label} className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition", view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>
                  <v.icon className="h-3.5 w-3.5" /><span className="hidden lg:inline">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contextual action bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-1.5 md:px-6">
            {canEdit ? (
              <>
                <Button size="sm" variant="outline" onClick={() => newItem("task")} disabled={!primaryId}><Plus className="h-3.5 w-3.5" /> Item</Button>
                <Button size="sm" variant="outline" onClick={() => newItem("milestone")} disabled={!primaryId}><Flag className="h-3.5 w-3.5" /> Milestone</Button>
                <Button size="sm" variant="ghost" onClick={addPhase} disabled={!primaryId}>Phase</Button>
              </>
            ) : null}
            {view === "gantt" || view === "timeline" ? (
              <>
                {canEdit ? <Button size="sm" variant={linkMode ? "accent" : "ghost"} onClick={() => setLinkMode((v) => !v)}><GitBranch className="h-3.5 w-3.5" /> Link</Button> : null}
                <Button size="sm" variant={showBaseline ? "accent" : "ghost"} onClick={() => setShowBaseline((v) => !v)}><CalendarClock className="h-3.5 w-3.5" /> Baseline</Button>
                {canManage ? <Button size="sm" variant="ghost" onClick={captureBaseline} disabled={!primaryId}>Capture baseline</Button> : null}
                <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">Zoom
                  <Select value={zoom} onChange={(e) => setZoom(e.target.value as never)} className="h-7 w-24 text-xs"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></Select>
                </div>
              </>
            ) : null}
            {view === "kanban" ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">Group by
                <Select value={kanbanGroup} onChange={(e) => setKanbanGroup(e.target.value as never)} className="h-7 w-28 text-xs"><option value="status">Status</option><option value="priority">Priority</option></Select>
              </div>
            ) : null}
            <div className="flex-1" />
            {primarySchedule ? <Button size="sm" variant="ghost" onClick={() => window.open(`/api/schedules/${primarySchedule.id}/pdf`, "_blank")}><FileText className="h-3.5 w-3.5" /> PDF</Button> : null}
            {primarySchedule && canManage ? (
              <div className="flex items-center gap-1">
                {!primarySchedule.is_master ? <Button size="sm" variant="ghost" onClick={() => setMaster(primarySchedule.id)}><Star className="h-3.5 w-3.5" /> Make Master</Button> : null}
                <Button size="sm" variant="ghost" onClick={() => archiveSchedule(primarySchedule.id)} className="text-muted-foreground"><Archive className="h-3.5 w-3.5" /></Button>
              </div>
            ) : null}
          </div>

          {banner ? <div className="flex items-center justify-between bg-accent/10 px-4 py-1.5 text-xs text-accent md:px-6"><span>{banner}</span><button type="button" onClick={() => setBanner(null)} className="font-medium">Dismiss</button></div> : null}

          {/* View body */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {loading && !items.length ? <div className="py-16 text-center text-sm text-muted-foreground">Loading schedule…</div> : null}
            {view === "gantt" || view === "timeline" ? (
              <GanttView items={items} dependencies={dependencies} phases={phases} zoom={view === "timeline" ? "month" : zoom} groupBySchedule={overlay || view === "timeline"} showBaseline={showBaseline} canEdit={canEdit} linkMode={linkMode} onOpenItem={setEditing} onDatesChange={ganttDates} onLink={(s, t) => addDependency(s, t)} />
            ) : view === "calendar" ? (
              <CalendarView items={items} onOpenItem={setEditing} />
            ) : view === "kanban" ? (
              <BoardView items={items} groupBy={kanbanGroup} canEdit={canEdit} onOpenItem={setEditing} onChange={boardChange} />
            ) : view === "resource" ? (
              <ResourceView items={items} onOpenItem={setEditing} />
            ) : (
              <ListView items={items} mode={view === "table" ? "table" : view === "card" ? "card" : "list"} showSchedule={overlay} onOpenItem={setEditing} />
            )}
          </div>
        </>
      )}

      <AddScheduleWizard open={wizardOpen} staff={staff} templates={templates} existing={schedules} onClose={() => setWizardOpen(false)} onCreate={createSchedule} />
      <ItemDrawer
        open={!!editing} item={editing} phases={phases.length ? phases : (primaryId ? bundles[primaryId]?.phases ?? [] : [])} staff={staff}
        allItems={items} dependencies={dependencies} isMasterSchedule={primarySchedule?.is_master} canEdit={canEdit}
        onClose={() => setEditing(null)} onSave={saveItem} onDelete={editing?.id ? deleteItem : undefined}
        onAddDependency={(sourceId, type, lag) => { if (editing?.id) void addDependency(sourceId, editing.id, type, lag); }}
        onRemoveDependency={removeDependency}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-sm font-medium">{value}</div></div>;
}
function EmptyState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <Layers className="h-10 w-10 text-muted-foreground/40" />
      <div><div className="font-medium">No schedules yet</div><div className="text-sm text-muted-foreground">Create independent schedules — Construction, Procurement, Selections, and more — for this job.</div></div>
      {canEdit ? <Button variant="accent" onClick={onAdd}><Plus className="h-4 w-4" /> Add Schedule</Button> : null}
    </div>
  );
}
