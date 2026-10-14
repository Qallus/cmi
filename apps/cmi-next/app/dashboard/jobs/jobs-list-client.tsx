"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Columns3, Download,
  LayoutGrid, List as ListIcon, Map as MapIcon, Plus, Search, Table as TableIcon, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobType, JobGroup, JobStatus } from "@/lib/jobs/types";
import type { JobReport } from "@/lib/jobs/reporting";
import { JobStatusBadge, JobColorDot, money, formatDate } from "./job-ui";
import { RecordsImportModal } from "@/components/dashboard/records-import-modal";
import { exportJobsCsv } from "@/lib/records-io/export";
import { QuickActionBar } from "@/components/dashboard/quick-action-bar";
import { DELETE_ROLES, WRITE_ROLES } from "@/lib/records-io/fields";

type SortKey = "job_name" | "job_number" | "city" | "status" | "projected_start_date" | "projected_completion_date" | "updated_at";
type ViewMode = "list" | "table" | "card" | "kanban" | "calendar";

const VIEWS: { key: ViewMode; label: string; icon: typeof ListIcon }[] = [
  { key: "list", label: "List", icon: ListIcon },
  { key: "table", label: "Table", icon: TableIcon },
  { key: "card", label: "Card", icon: LayoutGrid },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendar", icon: CalendarIcon },
];

const STATUS_OPTIONS = ALL_JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_META[s].label }));

type Sel = { selected: Set<string>; setSelected: React.Dispatch<React.SetStateAction<Set<string>>> };

export function JobsListClient({
  initialRows, types, groups, report, role = null,
}: {
  initialRows: JobListRow[];
  types: JobType[];
  groups: JobGroup[];
  report: JobReport;
  role?: string | null;
}) {
  const canWrite = !!role && WRITE_ROLES.jobs.includes(role);
  const canDelete = !!role && DELETE_ROLES.jobs.includes(role);
  const router = useRouter();
  const [rows, setRows] = React.useState<JobListRow[]>(initialRows);
  const [view, setView] = React.useState<ViewMode>("table");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [pmFilter, setPmFilter] = React.useState("all");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [activeOnly, setActiveOnly] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "updated_at", dir: "desc" });
  const [newMenu, setNewMenu] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const pms = React.useMemo(() => Array.from(new Set(rows.flatMap((r) => r.project_managers))).sort(), [rows]);

  // Status tabs apply to every view except Kanban (which shows all columns).
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    const out = rows.filter((r) => {
      // "Show archived" switches the list to archived jobs only, so Restore
      // always acts on what is on screen.
      if (showArchived ? !r.archived_at : r.archived_at) return false;
      if (view !== "kanban" && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.job_type_id !== typeFilter) return false;
      if (groupFilter !== "all" && r.job_group_id !== groupFilter) return false;
      if (pmFilter !== "all" && !r.project_managers.includes(pmFilter)) return false;
      if (activeOnly && !JOB_STATUS_META[r.status].open) return false;
      if (q) {
        const hay = `${r.job_name} ${r.job_number ?? ""} ${r.lead_number ?? ""} ${r.full_address ?? ""} ${r.city ?? ""} ${r.clients.map((c) => c.name).join(" ")} ${r.type_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * dir);
  }, [rows, view, search, statusFilter, typeFilter, groupFilter, pmFilter, activeOnly, sort, showArchived]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }
  const open = (id: string) => router.push(`/dashboard/jobs/${id}/summary`);

  // Only what is on screen counts as selected: filtering a checked job away
  // must not leave it silently in the next bulk action.
  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const selectedIds = selectedRows.map((r) => r.id);
  const allChecked = filtered.length > 0 && selectedRows.length === filtered.length;
  function toggleAll(on: boolean) { setSelected(on ? new Set(filtered.map((r) => r.id)) : new Set()); }
  const sel: Sel = { selected, setSelected };

  // Export the checked rows, or everything currently shown when none are checked.
  function exportCsv() { exportJobsCsv(selectedRows.length ? selectedRows : filtered); }
  async function reload(archived = showArchived) {
    try { const res = await fetch(archived ? "/api/jobs?archived=1" : "/api/jobs"); if (res.ok) setRows(await res.json()); } catch { /* keep list */ }
    router.refresh();
  }
  function toggleArchived(on: boolean) {
    setShowArchived(on);
    setSelected(new Set());
    void reload(on);
  }

  // Kanban drag → change status (optimistic, rollback on failure).
  async function updateStatus(id: string, status: JobStatus) {
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error();
    } catch { setRows(snapshot); }
  }

  const tiles = [
    { label: "Total", value: report.total },
    { label: "Active", value: report.active },
    { label: "Warranty", value: report.warranty },
    { label: "Closed", value: report.closed },
    { label: "Contract Value", value: money(report.total_contract_value) },
    { label: "Overdue", value: report.overdue_completions },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Management</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">{report.total} jobs</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" onClick={() => setView(v.key)} title={v.label}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition", view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                  <v.icon className="h-3.5 w-3.5" /> <span className="hidden lg:inline">{v.label}</span>
                </button>
              ))}
              <Link href="/dashboard/jobs/map" className="flex items-center gap-1.5 border-l border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" title="Map">
                <MapIcon className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Map</span>
              </Link>
            </div>
            <div className="w-40"><Select value="standard" onChange={() => {}} disabled><option value="standard">Standard View</option></Select></div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0} title={selectedRows.length ? "Export the checked jobs" : "Export every job shown"}>
              <Download className="h-3.5 w-3.5" /> {selectedRows.length ? `Export ${selectedRows.length}` : "Export"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-3.5 w-3.5" /> Import</Button>
            <div className="relative">
              <Button size="sm" variant="accent" onClick={() => setNewMenu((v) => !v)}><Plus className="h-3.5 w-3.5" /> New Job <ChevronDown className="h-3 w-3" /></Button>
              {newMenu && (
                <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  <Link href="/dashboard/jobs/new" className="block px-3 py-2 text-sm hover:bg-muted">From Scratch</Link>
                  <Link href="/dashboard/jobs/new-from-template" className="block px-3 py-2 text-sm hover:bg-muted">From Template</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&>*]:min-w-[30%] [&>*]:shrink-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 [&::-webkit-scrollbar]:hidden">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
              <div className="mt-0.5 text-sm font-semibold">{t.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search jobs…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
          </div>
          {view !== "kanban" && (
            <div className="w-36"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {ALL_JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_META[s].label}</option>)}
            </Select></div>
          )}
          <div className="w-36"><Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select></div>
          <div className="w-36"><Select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}>
            <option value="all">All PMs</option>
            {pms.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select></div>
          {groups.length > 0 && (
            <div className="w-36"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select></div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => toggleArchived(e.target.checked)} /> Show archived
          </label>
          {view !== "table" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /> Select all
            </label>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {view === "table" && <TableView rows={filtered} sort={sort} onSort={toggleSort} onOpen={open} {...sel} />}
        {view === "list" && <JobListView rows={filtered} onOpen={open} {...sel} />}
        {view === "card" && <CardView rows={filtered} onOpen={open} {...sel} />}
        {view === "kanban" && <KanbanView rows={filtered} onOpen={open} onStatusChange={updateStatus} {...sel} />}
        {view === "calendar" && <CalendarView rows={filtered} onOpen={open} {...sel} />}
      </div>
      <QuickActionBar
        target="jobs"
        ids={selectedIds}
        stages={STATUS_OPTIONS}
        canWrite={canWrite}
        canDelete={canDelete}
        showingArchived={showArchived}
        onEdit={(id) => router.push(`/dashboard/jobs/${id}/info`)}
        onClear={() => setSelected(new Set())}
        onDone={() => { setSelected(new Set()); void reload(); }}
      />
      {importOpen && <RecordsImportModal defaultTarget="jobs" onClose={() => setImportOpen(false)} onImported={() => void reload()} />}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────
// One row checkbox, shared by every view. Clicking it never opens the job.
function Check({ id, selected, setSelected }: { id: string } & Sel) {
  return (
    <input
      type="checkbox" aria-label="Select job" checked={selected.has(id)}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(id); else n.delete(id); return n; })}
    />
  );
}

function NextAction({ text, due }: { text: string | null; due: string | null }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  const overdue = !!due && due < new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-[220px]">
      <div className="truncate" title={text}>{text}</div>
      {due && <div className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>Due {formatDate(due)}</div>}
    </div>
  );
}

function TableView({ rows, sort, onSort, onOpen, selected, setSelected }: { rows: JobListRow[]; sort: { key: SortKey; dir: string }; onSort: (k: SortKey) => void; onOpen: (id: string) => void } & Sel) {
  return (
    <table className="w-full min-w-[1100px] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left">
          <th className="w-8 px-3 py-3">
            <input type="checkbox" aria-label="Select all"
              checked={rows.length > 0 && rows.every((j) => selected.has(j.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((j) => j.id)) : new Set())} />
          </th>
          <SortableTh label="Job" k="job_name" sort={sort} onSort={onSort} />
          <SortableTh label="Job #" k="job_number" sort={sort} onSort={onSort} />
          <Th>Street</Th>
          <SortableTh label="City" k="city" sort={sort} onSort={onSort} />
          <Th>State</Th><Th>Zip</Th><Th>PM</Th><Th>Clients</Th><Th>Client Phone</Th><Th>Type</Th>
          <SortableTh label="Status" k="status" sort={sort} onSort={onSort} />
          <SortableTh label="Start" k="projected_start_date" sort={sort} onSort={onSort} />
          <SortableTh label="Completion" k="projected_completion_date" sort={sort} onSort={onSort} />
          <Th>Next Action</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && <tr><td colSpan={15} className="px-4 py-12 text-center text-sm text-muted-foreground">No jobs found. Create one with “New Job”.</td></tr>}
        {rows.map((j) => (
          <tr key={j.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => onOpen(j.id)}>
            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
              <Check id={j.id} selected={selected} setSelected={setSelected} />
            </td>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="font-medium">{j.job_name}</span></div></td>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{j.job_number ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.street_address ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.city ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.state ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.zip_code ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.project_managers.join(", ") || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.clients.map((c) => c.name).join(", ") || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.clients[0]?.phone ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{j.type_name ?? "—"}</td>
            <td className="px-4 py-3"><JobStatusBadge status={j.status as JobStatus} /></td>
            <td className="px-4 py-3 text-muted-foreground">{formatDate(j.projected_start_date)}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDate(j.projected_completion_date)}</td>
            <td className="px-4 py-3"><NextAction text={j.next_action} due={j.next_action_due} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── List (compact) ──────────────────────────────────────────
function JobListView({ rows, onOpen, ...sel }: { rows: JobListRow[]; onOpen: (id: string) => void } & Sel) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="divide-y divide-border">
      {rows.map((j) => (
        <div key={j.id} role="button" tabIndex={0} onClick={() => onOpen(j.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(j.id); }}
          className={cn("flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/30 md:px-6", sel.selected.has(j.id) && "bg-accent/5")}>
          <Check id={j.id} {...sel} />
          <JobColorDot color={j.job_color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="truncate font-medium">{j.job_name}</span><JobStatusBadge status={j.status as JobStatus} /></div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{[j.job_number, j.full_address, j.type_name].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">{j.project_managers.join(", ")}</div>
          <div className="hidden shrink-0 text-xs text-muted-foreground md:block">{formatDate(j.projected_start_date)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Card grid ───────────────────────────────────────────────
function CardView({ rows, onOpen, ...sel }: { rows: JobListRow[]; onOpen: (id: string) => void } & Sel) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((j) => (
        <div key={j.id} role="button" tabIndex={0} onClick={() => onOpen(j.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(j.id); }}
          className={cn("cursor-pointer rounded-xl border bg-card p-4 text-left transition hover:border-accent/50", sel.selected.has(j.id) ? "border-accent" : "border-border")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Check id={j.id} {...sel} /><JobColorDot color={j.job_color} /><span className="font-mono text-[11px] text-muted-foreground">{j.job_number ?? ""}</span></div>
            <JobStatusBadge status={j.status as JobStatus} />
          </div>
          <div className="mt-1.5 font-medium leading-tight">{j.job_name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{[j.type_name, j.full_address].filter(Boolean).join(" · ") || "—"}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{j.project_managers[0] ?? ""}</span>
            <span className="font-medium text-foreground">{money(j.contract_price)}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(j.projected_start_date)} → {formatDate(j.projected_completion_date)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Kanban (drag to change status) ──────────────────────────
function KanbanView({ rows, onOpen, onStatusChange, ...sel }: { rows: JobListRow[]; onOpen: (id: string) => void; onStatusChange: (id: string, status: JobStatus) => void } & Sel) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<JobStatus | null>(null);
  function drop(status: JobStatus) {
    if (dragId) { const j = rows.find((x) => x.id === dragId); if (j && j.status !== status) onStatusChange(dragId, status); }
    setDragId(null); setOver(null);
  }
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {ALL_JOB_STATUSES.map((status) => {
        const items = rows.filter((j) => j.status === status);
        return (
          <div key={status} onDragOver={(e) => { e.preventDefault(); setOver(status); }} onDragLeave={() => setOver((s) => (s === status ? null : s))} onDrop={() => drop(status)}
            className={cn("flex w-72 shrink-0 flex-col rounded-lg border bg-card/50 transition", over === status ? "border-accent ring-2 ring-accent/30" : "border-border")}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <JobStatusBadge status={status} />
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((j) => (
                <div key={j.id} draggable onDragStart={() => setDragId(j.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => onOpen(j.id)}
                  className={cn("cursor-grab rounded-md border bg-background p-2.5 transition hover:border-accent/50 active:cursor-grabbing", sel.selected.has(j.id) ? "border-accent" : "border-border", dragId === j.id && "opacity-50")}>
                  <div className="flex items-center gap-2"><Check id={j.id} {...sel} /><JobColorDot color={j.job_color} /><span className="text-sm font-medium leading-tight">{j.job_name}</span></div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span className="truncate">{j.type_name ?? "—"}</span><span className="shrink-0">{money(j.contract_price)}</span></div>
                </div>
              ))}
              {items.length === 0 && <div className="px-2 py-6 text-center text-xs text-muted-foreground">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar (by projected start date) ──────────────────────
function CalendarView({ rows, onOpen, ...sel }: { rows: JobListRow[]; onOpen: (id: string) => void } & Sel) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDay = React.useMemo(() => {
    const m = new Map<string, JobListRow[]>();
    for (const j of rows) { if (!j.projected_start_date) continue; const k = j.projected_start_date.slice(0, 10); m.set(k, [...(m.get(k) ?? []), j]); }
    return m;
  }, [rows]);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })} <span className="ml-2 text-xs font-normal text-muted-foreground">by projected start</span></div>
        <div className="flex items-center gap-1">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-center text-[11px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-card py-2">{d}</div>)}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const items = byDay.get(key) ?? [];
          const muted = day.getMonth() !== cursor.getMonth();
          return (
            <div key={key} className={cn("min-h-[92px] bg-background p-1.5 text-left", muted && "opacity-40")}>
              <div className={cn("mb-1 text-[11px]", key === today ? "font-bold text-accent" : "text-muted-foreground")}>{day.getDate()}</div>
              <div className="space-y-1">
                {items.slice(0, 3).map((j) => (
                  <div key={j.id} className={cn("flex w-full items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-muted", sel.selected.has(j.id) && "ring-1 ring-accent")} style={{ background: j.job_color ? `${j.job_color}22` : undefined }}>
                    <Check id={j.id} {...sel} />
                    <button type="button" onClick={() => onOpen(j.id)} className="min-w-0 flex-1 truncate text-left">{j.job_name}</button>
                  </div>
                ))}
                {items.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="px-4 py-12 text-center text-sm text-muted-foreground">No jobs found. Create one with “New Job”.</div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</th>;
}
function SortableTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: { key: SortKey; dir: string }; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      <button type="button" onClick={() => onSort(k)} className={cn("flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}{active && <span>{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
