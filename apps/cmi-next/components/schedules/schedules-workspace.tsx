"use client";

import * as React from "react";
import { Plus, GitBranch, Flag, Layers, CalendarClock, CalendarRange, FileText, Star, Archive, ChevronDown, CornerDownRight, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, AutoTooltip } from "@/components/ui/tooltip";
import { VIEWS, HealthChip, TypeBadge, Progress, fmtDate, scheduleColor, scheduleTree } from "./shared";
import { GanttView } from "./views/gantt-view";
import { ListView } from "./views/list-view";
import { CalendarView } from "./views/calendar-view";
import { BoardView } from "./views/board-view";
import { ResourceView } from "./views/resource-view";
import { ItemDrawer } from "./item-drawer";
import { AddScheduleWizard, type ScheduleSource } from "./add-schedule-wizard";
import { ShiftDialog } from "./shift-dialog";
import { EngineDialog } from "./engine-dialog";
import { CalendarEditor } from "./calendar-editor";
import { ScheduleModal } from "./schedule-modal";
import { ScheduleGrid } from "./grid/schedule-grid";
import { createScheduleFromWizard } from "./create-schedule";
import { SCHEDULING_MODE_LABELS, type JobSchedule, type ScheduleItem, type SchedulePhase, type ScheduleDependency, type ScheduleView, type ScheduleDraft, type DependencyType, type ScheduleType, type ScheduleScope, type SchedulingMode } from "@/lib/schedules/types";

type Staff = { id: string; name: string };
type Bundle = { schedule: JobSchedule; phases: SchedulePhase[]; items: ScheduleItem[]; dependencies: ScheduleDependency[] };
type ContractRow = { id: string; title: string; contract_date: string; milestone_type: string | null; forecast: string | null; variance: number | null };
type EngineState = { enabled: boolean; mode: SchedulingMode; canSwitch: boolean; summary: { finish: string | null; critical: { id: string }[]; loops: number; contract?: ContractRow[] } | null };
type Header = { schedule_count: number; active_count: number; overall_progress: number; health: string; projected_completion: string | null; next_milestone: { title: string; date: string | null; schedule_name: string } | null };

// `scope`: whose schedules these are (a job, or with the Schedule Builder a deal,
// Pre-Con record or selection). `builder` turns on schedules-inside-schedules and
// item links. `initialScheduleId` opens a particular schedule (?schedule=… links).
export function SchedulesWorkspace({ scope, scopeLabel, initialSchedules, initialHeader, staff, canEdit, canManage, builder = false, initialScheduleId }: {
  scope: ScheduleScope; scopeLabel: string; initialSchedules: JobSchedule[]; initialHeader: Header; staff: Staff[]; canEdit: boolean; canManage: boolean;
  builder?: boolean; initialScheduleId?: string | null;
}) {
  const jobId = scope.type === "job" ? scope.id : null;
  const scopeApi = `/api/schedule-scopes/${scope.type}/${scope.id}`;
  const [schedules, setSchedules] = React.useState<JobSchedule[]>(initialSchedules);
  const [header, setHeader] = React.useState<Header>(initialHeader);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(
    initialScheduleId && initialSchedules.some((s) => s.id === initialScheduleId) ? [initialScheduleId] : initialSchedules.slice(0, 1).map((s) => s.id),
  ));
  const [parentForNew, setParentForNew] = React.useState<string | null>(null);
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
  const [pkgStart, setPkgStart] = React.useState("");
  const [shiftOpen, setShiftOpen] = React.useState(false);
  const [engineOpen, setEngineOpen] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [engine, setEngine] = React.useState<EngineState | null>(null);

  React.useEffect(() => {
    fetch("/api/schedule-templates").then((r) => r.json()).then((d) => { setTemplates(d.templates ?? []); setPackages(d.packages ?? []); }).catch(() => {});
  }, []);

  const applyingPkg = React.useRef(false);
  async function applyPackage(packageId: string) {
    setPkgMenu(false);
    if (applyingPkg.current) return; // a second click while one is running would create every schedule twice
    if (!confirm("Apply this package? It creates several schedules with phases, items, and milestones.")) return;
    applyingPkg.current = true;
    try { await runPackage(packageId); } finally { applyingPkg.current = false; }
  }
  async function runPackage(packageId: string) {
    setBanner("Applying package…");
    const res = await fetch(`${scopeApi}/packages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId, startDate: pkgStart || null }) });
    if (res.ok) { await refreshSchedules(); const d = await res.json(); if (d.created?.[0]) { setSelected(new Set([d.created[0].id])); await loadBundle(d.created[0].id); } setBanner("Package applied."); }
    else setBanner("Could not apply the package.");
  }

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);
  const primaryId = selectedIds[0] ?? null;
  const primarySchedule = schedules.find((s) => s.id === primaryId) ?? null;
  const overlay = selectedIds.length > 1;

  // Schedule engine (flag schedule_engine): this schedule's mode, finish and critical path.
  const refreshEngine = React.useCallback(async () => {
    if (!primaryId) { setEngine(null); return; }
    const res = await fetch(`/api/schedules/${primaryId}/engine`);
    setEngine(res.ok ? await res.json() : null);
  }, [primaryId]);
  React.useEffect(() => {
    if (!primaryId) return;
    let live = true;
    fetch(`/api/schedules/${primaryId}/engine`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setEngine(d); }).catch(() => {});
    return () => { live = false; };
  }, [primaryId]);

  const loadBundle = React.useCallback(async (id: string): Promise<Bundle | null> => {
    const res = await fetch(`/api/schedules/${id}`);
    if (!res.ok) return null;
    const b = await res.json();
    const bundle: Bundle = { schedule: b.schedule, phases: b.phases, items: b.items, dependencies: b.dependencies };
    setBundles((prev) => ({ ...prev, [id]: bundle }));
    return bundle;
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
    const res = await fetch(scopeApi);
    if (res.ok) { const d = await res.json(); setSchedules(d.schedules); setHeader(d.header); }
  }, [scopeApi]);

  // Derived working set across selected schedules.
  const items = React.useMemo(() => selectedIds.flatMap((id) => bundles[id]?.items ?? []), [selectedIds, bundles]);
  const dependencies = React.useMemo(() => {
    const seen = new Set<string>(); const out: ScheduleDependency[] = [];
    for (const id of selectedIds) for (const d of bundles[id]?.dependencies ?? []) if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
    return out;
  }, [selectedIds, bundles]);
  const phases = overlay ? [] : (primaryId ? bundles[primaryId]?.phases ?? [] : []);
  // Schedules whose dates the engine works out: a drag sends only the start
  // (move) or the end (resize) and the engine keeps the length in working days.
  const engineIds = React.useMemo(() => new Set(engine?.enabled ? selectedIds.filter((id) => (bundles[id]?.schedule.scheduling_mode ?? "legacy") !== "legacy") : []), [engine?.enabled, selectedIds, bundles]);

  function toggleSchedule(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return n; });
  }
  function soloSchedule(id: string) { setSelected(new Set([id])); setSelectorOpen(false); }

  // ---- item ops ----
  async function saveItem(patch: Partial<ScheduleItem>) {
    if (!primaryId && !editing?.id) return;
    if (editing?.id) {
      const res = await fetch(`/api/schedule-items/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setBanner(d.error ?? "Could not save the item."); return; }
      if (d.cascaded?.length) setBanner(`${d.cascaded.length} downstream item${d.cascaded.length === 1 ? "" : "s"} shifted.`);
    } else {
      const sid = (patch.schedule_id as string) || primaryId!;
      await fetch(`/api/schedules/${sid}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    }
    setEditing(null);
    await Promise.all(selectedIds.map(loadBundle));
    void refreshSchedules();
    void refreshEngine();
  }
  async function deleteItem() {
    if (!editing?.id) return;
    await fetch(`/api/schedule-items/${editing.id}`, { method: "DELETE" });
    setEditing(null);
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function ganttDates(id: string, start: string, end: string, gesture: "move" | "resize") {
    const item = items.find((i) => i.id === id);
    const onEngine = !!item && engineIds.has(item.schedule_id);
    const body = onEngine ? (gesture === "move" ? { start_date: start } : { end_date: end }) : { start_date: start, end_date: end, cascade: true };
    const res = await fetch(`/api/schedule-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setBanner(d.error ?? "Could not move the item.");
    else if (d.cascaded?.length) setBanner(`${d.cascaded.length} downstream item${d.cascaded.length === 1 ? "" : "s"} ${onEngine ? "moved" : "shifted"}.`);
    await Promise.all(selectedIds.map(loadBundle));
    if (onEngine) void refreshEngine();
  }
  async function boardChange(id: string, patch: Partial<ScheduleItem>) {
    await fetch(`/api/schedule-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, cascade: false }) });
    await Promise.all(selectedIds.map(loadBundle));
  }
  async function addDependency(sourceItemId: string, targetItemId: string, type: DependencyType = "finish_to_start", lag = 0) {
    const res = await fetch(`/api/schedule-dependencies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, sourceItemId, targetItemId, type, lagDays: lag }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setBanner(d.error ?? "Could not add the link."); }
    await Promise.all(selectedIds.map(loadBundle));
    void refreshEngine();
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
    const { schedule, message } = await createScheduleFromWizard(scope, { ...draft, parent_schedule_id: draft.parent_schedule_id ?? parentForNew }, source);
    setParentForNew(null);
    setBanner(message);
    if (!schedule) return;
    setWizardOpen(false);
    await refreshSchedules();
    setSelected(new Set([schedule.id]));
    await loadBundle(schedule.id);
  }

  const newItem = (kind: "task" | "milestone") => setEditing({ kind, schedule_id: primaryId ?? undefined, status: "not_started", priority: "normal", percent_complete: 0, all_day: true });

  return (
    <div className="flex h-full flex-col">
      {/* Header rollup */}
      <div className="border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{scopeLabel}</div>
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
                    <label className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">Start date
                      <input type="date" value={pkgStart} onChange={(e) => setPkgStart(e.target.value)} className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground" />
                    </label>
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
                    {scheduleTree(schedules).map(({ schedule: s, depth }) => (
                      <div key={s.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50" style={{ paddingLeft: 8 + depth * 14 }}>
                        {depth ? <CornerDownRight className="-mr-1 h-3 w-3 shrink-0 text-muted-foreground/60" /> : null}
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
                <AutoTooltip key={v.key} content={v.label}><button type="button" onClick={() => setView(v.key)} aria-label={v.label} className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition", view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>
                  <v.icon className="h-3.5 w-3.5" /><span className="hidden lg:inline">{v.label}</span>
                </button></AutoTooltip>
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
                <Segmented label="Zoom" value={zoom} onChange={setZoom} options={[["day", "Day"], ["week", "Week"], ["month", "Month"]]} />
              </>
            ) : null}
            {view === "kanban" ? (
              <Segmented label="Group by" value={kanbanGroup} onChange={setKanbanGroup} options={[["status", "Status"], ["priority", "Priority"]]} />
            ) : null}
            <div className="flex-1" />
            {builder && primarySchedule && canEdit && !overlay ? <AutoTooltip content="Add a schedule inside this one"><Button size="sm" variant="ghost" onClick={() => { setParentForNew(primarySchedule.id); setWizardOpen(true); }}><CornerDownRight className="h-3.5 w-3.5" /> Add inside</Button></AutoTooltip> : null}
            {engine?.enabled && primarySchedule && !overlay ? (
              <>
                {engine.summary ? <AutoTooltip content="Worked out from the links, the work calendar and holidays"><span className="text-xs text-muted-foreground">Finish <span className="font-medium text-foreground">{fmtDate(engine.summary.finish)}</span> · {engine.summary.critical.length} critical{engine.summary.loops ? <span className="text-destructive"> · {engine.summary.loops} loop{engine.summary.loops === 1 ? "" : "s"} ignored</span> : null}</span></AutoTooltip> : null}
                {(() => {
                  // The contract milestone furthest behind (Spec R2 §7.2: "vs. contract +5 wd").
                  const worst = (engine.summary?.contract ?? []).filter((c) => c.variance != null).sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0))[0];
                  if (!worst) return null;
                  const v = worst.variance!;
                  return <AutoTooltip content={`${worst.title}: contract ${fmtDate(worst.contract_date)}, forecast ${fmtDate(worst.forecast)}`}><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", v > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>vs contract {v === 0 ? "on date" : `${v > 0 ? "+" : ""}${v} wd`}</span></AutoTooltip>;
                })()}
                <Tooltip label={engine.canSwitch ? "How this schedule's dates are worked out" : "Admins and Project Managers change this"} side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={() => setEngineOpen(true)} disabled={!engine.canSwitch}><Route className="h-3.5 w-3.5" /> {SCHEDULING_MODE_LABELS[engine.mode]}</Button></Tooltip>
              </>
            ) : null}
            {engine?.enabled && primarySchedule && !overlay ? <AutoTooltip content={primarySchedule.job_id ? "This job's working days and closed days" : "This schedule's working days and closed days"}><Button size="sm" variant="ghost" onClick={() => setCalendarOpen(true)}><CalendarClock className="h-3.5 w-3.5" /> Calendar</Button></AutoTooltip> : null}
            {primarySchedule && canEdit && !overlay ? <Button size="sm" variant="ghost" onClick={() => setShiftOpen(true)}><CalendarRange className="h-3.5 w-3.5" /> Shift dates</Button> : null}
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
            ) : view === "table" && engine?.enabled && primarySchedule && !overlay ? (
              <ScheduleGrid
                key={primarySchedule.id} schedule={primarySchedule} items={items} phases={phases} dependencies={dependencies}
                canEdit={canEdit} zoom={zoom} showBaseline={showBaseline} linkMode={linkMode}
                onOpenItem={setEditing} onBanner={setBanner} onDatesChange={ganttDates} onLink={(s, t) => addDependency(s, t)}
                onReload={async () => { const b = await loadBundle(primarySchedule.id); void refreshEngine(); return b?.items ?? null; }}
                mode={engine.mode} contractVariances={new Map((engine.summary?.contract ?? []).map((c) => [c.id, c.variance]))}
              />
            ) : (
              <ListView items={items} mode={view === "table" ? "table" : view === "card" ? "card" : "list"} showSchedule={overlay} onOpenItem={setEditing} />
            )}
          </div>
        </>
      )}

      {engineOpen && engine ? <EngineDialog key={primarySchedule?.id} open schedule={primarySchedule} currentMode={engine.mode} onClose={() => setEngineOpen(false)} onSwitched={async (p) => {
        setEngineOpen(false);
        setBanner(p.mode === "legacy" ? "Back to pushing linked tasks later only." : `Now ${SCHEDULING_MODE_LABELS[p.mode].toLowerCase()}. ${p.moved.length ? `${p.moved.length} task${p.moved.length === 1 ? "" : "s"} moved; ` : "No dates changed; "}finish ${fmtDate(p.finishAfter)}.`);
        if (primaryId) await loadBundle(primaryId);
        void refreshEngine(); void refreshSchedules();
      }} /> : null}
      {calendarOpen && primarySchedule ? (
        <ScheduleModal open title={primarySchedule.job_id ? `Job calendar` : `Calendar: ${primarySchedule.name}`} onClose={() => setCalendarOpen(false)}>
          <div className="pb-4">
            <CalendarEditor
              scope={primarySchedule.job_id ? "job" : "schedule"} scopeId={primarySchedule.job_id ?? primarySchedule.id}
              intro={primarySchedule.job_id
                ? "Applies to every schedule on this job, on top of the company calendar (Settings → Scheduling). Add working Saturdays, or closed days by type (weather, owner, jurisdiction) — the counts help with time-extension requests."
                : "Applies to this schedule, on top of the company calendar (Settings → Scheduling)."}
              onSaved={async (m) => { setBanner(m); if (primaryId) await loadBundle(primaryId); void refreshEngine(); }}
            />
          </div>
        </ScheduleModal>
      ) : null}
      {shiftOpen ? <ShiftDialog key={primarySchedule?.id} open schedule={primarySchedule} onClose={() => setShiftOpen(false)} onShifted={async (p) => {
        setShiftOpen(false);
        setBanner(`${p.moved} item${p.moved === 1 ? "" : "s"} moved ${Math.abs(p.workdays)} working day${Math.abs(p.workdays) === 1 ? "" : "s"} ${p.workdays > 0 ? "later" : "earlier"}. Now ${fmtDate(p.to)} to ${fmtDate(p.finish)}.`);
        if (primaryId) await loadBundle(primaryId);
        void refreshSchedules();
      }} /> : null}
      <AddScheduleWizard open={wizardOpen} staff={staff} templates={templates} existing={schedules} onClose={() => { setWizardOpen(false); setParentForNew(null); }} onCreate={createSchedule}
        parents={builder ? schedules : undefined} defaultParentId={parentForNew} scopeNoun={scope.type === "job" ? "Job" : scope.type === "deal" ? "Deal" : scope.type === "precon" ? "Pre-Con" : "Selection"} />
      <ItemDrawer
        open={!!editing} item={editing} phases={phases.length ? phases : (primaryId ? bundles[primaryId]?.phases ?? [] : [])} staff={staff}
        allItems={items} dependencies={dependencies} isMasterSchedule={primarySchedule?.is_master} canEdit={canEdit} linkable={builder}
        engine={!!engine?.enabled}
        onClose={() => setEditing(null)} onSave={saveItem} onDelete={editing?.id ? deleteItem : undefined}
        onAddDependency={(sourceId, type, lag) => { if (editing?.id) void addDependency(sourceId, editing.id, type, lag); }}
        onRemoveDependency={removeDependency}
      />
    </div>
  );
}

/** A small labelled segmented control, sized to sit in the action bar with the buttons. */
function Segmented<V extends string>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: [V, string][] }) {
  return (
    <div className="ml-1 flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex h-8 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={cn("h-full rounded px-2.5 text-xs font-medium transition", value === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {text}
          </button>
        ))}
      </div>
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
