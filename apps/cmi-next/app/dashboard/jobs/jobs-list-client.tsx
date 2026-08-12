"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Columns3,
  LayoutGrid, List as ListIcon, Map as MapIcon, Plus, Search, Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobType, JobGroup, JobStatus } from "@/lib/jobs/types";
import type { JobReport } from "@/lib/jobs/reporting";
import { JobStatusBadge, JobColorDot, money, formatDate } from "./job-ui";

type SortKey = "job_name" | "job_number" | "city" | "status" | "projected_start_date" | "projected_completion_date" | "updated_at";
type ViewMode = "list" | "table" | "card" | "kanban" | "calendar";

const VIEWS: { key: ViewMode; label: string; icon: typeof ListIcon }[] = [
  { key: "list", label: "List", icon: ListIcon },
  { key: "table", label: "Table", icon: TableIcon },
  { key: "card", label: "Card", icon: LayoutGrid },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendar", icon: CalendarIcon },
];

export function JobsListClient({
  initialRows, types, groups, report,
}: {
  initialRows: JobListRow[];
  types: JobType[];
  groups: JobGroup[];
  report: JobReport;
}) {
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

  const pms = React.useMemo(() => Array.from(new Set(rows.flatMap((r) => r.project_managers))).sort(), [rows]);

  // Status tabs apply to every view except Kanban (which shows all columns).
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    const out = rows.filter((r) => {
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
  }, [rows, view, search, statusFilter, typeFilter, groupFilter, pmFilter, activeOnly, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }
  const open = (id: string) => router.push(`/dashboard/jobs/${id}/summary`);

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
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {view === "table" && <TableView rows={filtered} sort={sort} onSort={toggleSort} onOpen={open} selected={selected} setSelected={setSelected} />}
        {view === "list" && <JobListView rows={filtered} onOpen={open} />}
        {view === "card" && <CardView rows={filtered} onOpen={open} />}
        {view === "kanban" && <KanbanView rows={filtered} onOpen={open} onStatusChange={updateStatus} />}
        {view === "calendar" && <CalendarView rows={filtered} onOpen={open} />}
      </div>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────
function TableView({ rows, sort, onSort, onOpen, selected, setSelected }: { rows: JobListRow[]; sort: { key: SortKey; dir: string }; onSort: (k: SortKey) => void; onOpen: (id: string) => void; selected: Set<string>; setSelected: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  return (
    <table className="w-full min-w-[1100px] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left">
          <th className="w-8 px-3 py-3" />
          <SortableTh label="Job" k="job_name" sort={sort} onSort={onSort} />
          <SortableTh label="Job #" k="job_number" sort={sort} onSort={onSort} />
          <Th>Street</Th>
          <SortableTh label="City" k="city" sort={sort} onSort={onSort} />
          <Th>State</Th><Th>Zip</Th><Th>PM</Th><Th>Clients</Th><Th>Client Phone</Th><Th>Type</Th>
          <SortableTh label="Status" k="status" sort={sort} onSort={onSort} />
          <SortableTh label="Start" k="projected_start_date" sort={sort} onSort={onSort} />
          <SortableTh label="Completion" k="projected_completion_date" sort={sort} onSort={onSort} />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && <tr><td colSpan={14} className="px-4 py-12 text-center text-sm text-muted-foreground">No jobs found. Create one with “New Job”.</td></tr>}
        {rows.map((j) => (
          <tr key={j.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => onOpen(j.id)}>
            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={selected.has(j.id)} onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(j.id); else n.delete(j.id); return n; })} />
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── List (compact) ──────────────────────────────────────────
function JobListView({ rows, onOpen }: { rows: JobListRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="divide-y divide-border">
      {rows.map((j) => (
        <button key={j.id} type="button" onClick={() => onOpen(j.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/30 md:px-6">
          <JobColorDot color={j.job_color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="truncate font-medium">{j.job_name}</span><JobStatusBadge status={j.status as JobStatus} /></div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{[j.job_number, j.full_address, j.type_name].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">{j.project_managers.join(", ")}</div>
          <div className="hidden shrink-0 text-xs text-muted-foreground md:block">{formatDate(j.projected_start_date)}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Card grid ───────────────────────────────────────────────
function CardView({ rows, onOpen }: { rows: JobListRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((j) => (
        <button key={j.id} type="button" onClick={() => onOpen(j.id)} className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-accent/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="font-mono text-[11px] text-muted-foreground">{j.job_number ?? ""}</span></div>
            <JobStatusBadge status={j.status as JobStatus} />
          </div>
          <div className="mt-1.5 font-medium leading-tight">{j.job_name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{[j.type_name, j.full_address].filter(Boolean).join(" · ") || "—"}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{j.project_managers[0] ?? ""}</span>
            <span className="font-medium text-foreground">{money(j.contract_price)}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(j.projected_start_date)} → {formatDate(j.projected_completion_date)}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Kanban (drag to change status) ──────────────────────────
function KanbanView({ rows, onOpen, onStatusChange }: { rows: JobListRow[]; onOpen: (id: string) => void; onStatusChange: (id: string, status: JobStatus) => void }) {
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
                  className={cn("cursor-grab rounded-md border border-border bg-background p-2.5 transition hover:border-accent/50 active:cursor-grabbing", dragId === j.id && "opacity-50")}>
                  <div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="text-sm font-medium leading-tight">{j.job_name}</span></div>
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
function CalendarView({ rows, onOpen }: { rows: JobListRow[]; onOpen: (id: string) => void }) {
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
                  <button key={j.id} type="button" onClick={() => onOpen(j.id)} className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-muted" style={{ background: j.job_color ? `${j.job_color}22` : undefined }}>
                    <span className="truncate">{j.job_name}</span>
                  </button>
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
