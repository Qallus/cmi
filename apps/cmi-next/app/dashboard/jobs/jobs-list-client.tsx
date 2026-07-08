"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Map as MapIcon, Plus, Search, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobType, JobGroup, JobStatus } from "@/lib/jobs/types";
import type { JobReport } from "@/lib/jobs/reporting";
import { JobStatusBadge, JobColorDot, money, formatDate } from "./job-ui";

type SortKey = "job_name" | "job_number" | "city" | "status" | "projected_start_date" | "projected_completion_date" | "updated_at";

export function JobsListClient({
  initialRows, types, groups, report,
}: {
  initialRows: JobListRow[];
  types: JobType[];
  groups: JobGroup[];
  report: JobReport;
}) {
  const router = useRouter();
  const [rows] = React.useState<JobListRow[]>(initialRows);
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

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    const out = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.job_type_id !== typeFilter) return false;
      if (groupFilter !== "all" && r.job_group_id !== groupFilter) return false;
      if (pmFilter !== "all" && !r.project_managers.includes(pmFilter)) return false;
      if (activeOnly && !JOB_STATUS_META[r.status].open) return false;
      if (q) {
        const hay = `${r.job_name} ${r.job_number ?? ""} ${r.full_address ?? ""} ${r.city ?? ""} ${r.clients.map((c) => c.name).join(" ")} ${r.type_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, search, statusFilter, typeFilter, groupFilter, pmFilter, activeOnly, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
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
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <span className="flex items-center gap-1.5 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent"><TableIcon className="h-3.5 w-3.5" /> List</span>
              <Link href="/dashboard/jobs/map" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><MapIcon className="h-3.5 w-3.5" /> Map</Link>
            </div>
            {/* Saved View — placeholder until custom views are stored */}
            <div className="w-40">
              <Select value="standard" onChange={() => {}} disabled>
                <option value="standard">Standard View</option>
              </Select>
            </div>
            <div className="relative">
              <Button size="sm" variant="accent" onClick={() => setNewMenu((v) => !v)}><Plus className="h-3.5 w-3.5" /> New Job <ChevronDown className="h-3 w-3" /></Button>
              {newMenu && (
                <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  <Link href="/dashboard/jobs/new" className="block px-3 py-2 text-sm hover:bg-muted">From Scratch</Link>
                  <Link href="/dashboard/jobs/new-from-template" className="block px-3 py-2 text-sm hover:bg-muted">From Template</Link>
                  <Link href="/dashboard/jobs?templates=1" className="block border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">View Templates →</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
          <div className="w-36"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {ALL_JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_META[s].label}</option>)}
          </Select></div>
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left">
              <th className="w-8 px-3 py-3" />
              <SortableTh label="Job" k="job_name" sort={sort} onSort={toggleSort} />
              <SortableTh label="Job #" k="job_number" sort={sort} onSort={toggleSort} />
              <Th>Street</Th>
              <SortableTh label="City" k="city" sort={sort} onSort={toggleSort} />
              <Th>State</Th>
              <Th>Zip</Th>
              <Th>PM</Th>
              <Th>Clients</Th>
              <Th>Client Phone</Th>
              <Th>Type</Th>
              <SortableTh label="Status" k="status" sort={sort} onSort={toggleSort} />
              <SortableTh label="Start" k="projected_start_date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Completion" k="projected_completion_date" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="px-4 py-12 text-center text-sm text-muted-foreground">No jobs found. Create one with “New Job”.</td></tr>
            )}
            {filtered.map((j) => {
              const client = j.clients[0];
              return (
                <tr key={j.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => router.push(`/dashboard/jobs/${j.id}/summary`)}>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(j.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(j.id); else n.delete(j.id); setSelected(n); }} />
                  </td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="font-medium">{j.job_name}</span></div></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{j.job_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.street_address ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.city ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.state ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.zip_code ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.project_managers.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.clients.map((c) => c.name).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client?.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.type_name ?? "—"}</td>
                  <td className="px-4 py-3"><JobStatusBadge status={j.status as JobStatus} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(j.projected_start_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(j.projected_completion_date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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
