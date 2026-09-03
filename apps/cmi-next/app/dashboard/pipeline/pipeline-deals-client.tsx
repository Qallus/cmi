"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, UserPlus, X, Loader2, Phone, MessageSquare, Mail, StickyNote,
  Mic, Sparkles, Package, CalendarClock, Users2, MapPin, ScanLine, CheckCircle2,
  Circle, ArrowRight, Clock, TrendingUp, Trophy, CalendarDays,
  List as ListIcon, Table2, Columns3, Map as MapIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEAL_STAGE_META, DEAL_STAGES, LOST_REASONS, DEAL_SOURCES } from "@/lib/deals/stages";
import type { Deal, DealStage, Activity, ActivityType, DealTask, DealStageHistoryRow } from "@/lib/deals/types";

export type OwnerOption = { id: string; name: string };
export type SourceRow = { id: string; label: string; sub: string };

type ViewMode = "list" | "table" | "kanban" | "calendar" | "map";
const VIEWS: { key: ViewMode; label: string; icon: typeof ListIcon }[] = [
  { key: "list", label: "List", icon: ListIcon },
  { key: "table", label: "Table", icon: Table2 },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "map", label: "Map", icon: MapIcon },
];
const JOB_TYPES = ["Whole Home Remodel", "Kitchen", "Bathroom Remodel", "ADU/Casita", "Addition", "New Build", "Tenant Improvement", "Warranty", "Service Work", "Other"];

const TONE_CLASS: Record<string, string> = {
  info: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  accent: "bg-accent/15 text-accent",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = {
  call: Phone, sms: MessageSquare, email: Mail, note: StickyNote, voice_note: Mic,
  ai_agent: Sparkles, selection: Package, appointment: CalendarClock, meeting: Users2,
  site_visit: MapPin, scan_3d: ScanLine,
};
const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Call", sms: "SMS", email: "Email", note: "Note", voice_note: "Voice note",
  ai_agent: "AI agent", selection: "Selection", appointment: "Appointment",
  meeting: "Meeting", site_visit: "Site visit", scan_3d: "3D scan",
};

const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function fmtWhen(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function StageBadge({ stage }: { stage: DealStage }) {
  const m = DEAL_STAGE_META[stage];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_CLASS[m.tone])}>{m.label}</span>;
}

export function PipelineDealsClient({
  initialDeals, owners, contacts, quotes, submissions, canWrite,
}: {
  initialDeals: Deal[]; owners: OwnerOption[]; contacts: SourceRow[]; quotes: SourceRow[]; submissions: SourceRow[]; canWrite: boolean;
}) {
  const router = useRouter();
  const [deals, setDeals] = React.useState<Deal[]>(initialDeals);
  const [view, setView] = React.useState<ViewMode>("list");
  const [query, setQuery] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [stageFilter, setStageFilter] = React.useState<DealStage | "all">("all");
  const [jobTypeFilter, setJobTypeFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);

  const ownerName = React.useCallback((id: string | null) => owners.find((o) => o.id === id)?.name ?? "Unassigned", [owners]);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/deals");
    if (res.ok) setDeals(await res.json());
  }, []);

  const openDeal = React.useCallback((id: string) => router.push(`/dashboard/pipeline/${id}`), [router]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (ownerFilter !== "all" && d.owner_id !== ownerFilter) return false;
      if (stageFilter !== "all" && d.stage !== stageFilter) return false;
      if (jobTypeFilter !== "all" && (d.job_type ?? "") !== jobTypeFilter) return false;
      if (dateFrom && (!d.expected_close_date || d.expected_close_date < dateFrom)) return false;
      if (dateTo && (!d.expected_close_date || d.expected_close_date > dateTo)) return false;
      if (!q) return true;
      return [d.title, d.job_number, d.next_action, d.source, d.job_type].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [deals, query, ownerFilter, stageFilter, jobTypeFilter, dateFrom, dateTo]);

  const filtersActive = ownerFilter !== "all" || stageFilter !== "all" || jobTypeFilter !== "all" || !!dateFrom || !!dateTo || !!query;
  function clearFilters() { setOwnerFilter("all"); setStageFilter("all"); setJobTypeFilter("all"); setDateFrom(""); setDateTo(""); setQuery(""); }

  // Kanban drag-to-move: optimistic stage update, then persist + refresh.
  const moveStage = React.useCallback(async (id: string, to: DealStage) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage: to } : d)));
    const res = await fetch(`/api/deals/${id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, patch: to === "lost_on_hold" ? { lost_reason: "moved on board" } : {} }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || "Couldn't move deal."); }
    await refresh();
  }, [refresh]);

  const openDeals = deals.filter((d) => DEAL_STAGE_META[d.stage].open);
  const stats = {
    open: openDeals.length,
    value: openDeals.reduce((sum, d) => sum + (d.estimated_value ?? 0), 0),
    won: deals.filter((d) => d.stage === "closed_won").length,
    dueToday: deals.filter((d) => d.next_action_due && d.next_action_due <= new Date().toISOString().slice(0, 10) && DEAL_STAGE_META[d.stage].open).length,
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header + stat cards */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">Leads and opportunities from first inquiry to Closed Won.</p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4" /> Add to Pipeline</Button>
              <Button variant="accent" size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Deal</Button>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={TrendingUp} label="Open deals" value={String(stats.open)} tone="accent" />
          <StatCard icon={TrendingUp} label="Pipeline value" value={money(stats.value)} tone="success" />
          <StatCard icon={Trophy} label="Closed Won" value={String(stats.won)} tone="success" />
          <StatCard icon={CalendarDays} label="Follow-ups due" value={String(stats.dueToday)} tone={stats.dueToday ? "warning" : "muted"} />
        </div>
      </div>

      {/* Toolbar: view switcher + filters */}
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)} title={v.label}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition", view === v.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                <v.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals…" className="pl-8" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as DealStage | "all")} className="w-auto min-w-[130px]">
            <option value="all">All Stages</option>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_META[s].label}</option>)}
          </Select>
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-auto min-w-[130px]">
            <option value="all">All Owners</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)} className="w-auto min-w-[130px]">
            <option value="all">All Job Types</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Close</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
            <span>–</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          </div>
          {filtersActive && <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Clear filters</button>}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} deal{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* View area */}
      <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {deals.length === 0 ? <>No deals yet. {canWrite && "Use “Add Deal” or “Add to Pipeline” to get started."}</> : "No deals match the current filters."}
          </div>
        ) : view === "list" ? (
          <ListView deals={filtered} ownerName={ownerName} onOpen={openDeal} />
        ) : view === "table" ? (
          <TableView deals={filtered} ownerName={ownerName} onOpen={openDeal} />
        ) : view === "kanban" ? (
          <KanbanView deals={filtered} onOpen={openDeal} canWrite={canWrite} onMove={moveStage} />
        ) : view === "calendar" ? (
          <CalendarView deals={filtered} onOpen={openDeal} />
        ) : (
          <MapView />
        )}
      </div>

      {showCreate && (
        <DealFormModal
          owners={owners} contacts={contacts} title="Add Deal"
          onClose={() => setShowCreate(false)}
          onSaved={async () => { setShowCreate(false); await refresh(); }}
        />
      )}
      {showAdd && (
        <AddToPipelineModal
          contacts={contacts} quotes={quotes} submissions={submissions} deals={deals}
          onClose={() => setShowAdd(false)}
          onAdded={async () => { setShowAdd(false); await refresh(); }}
        />
      )}
    </div>
  );
}

// ─── List view (roomy rows) ───────────────────────────────────────
function ListView({ deals, ownerName, onOpen }: { deals: Deal[]; ownerName: (id: string | null) => string; onOpen: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Deal</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium text-right">Value</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Last activity</th>
            <th className="px-3 py-2 font-medium">Next action</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const overdue = d.next_action_due && d.next_action_due < today;
            return (
              <tr key={d.id} onClick={() => onOpen(d.id)} className="cursor-pointer border-t border-border transition hover:bg-muted/40">
                <td className="px-3 py-2.5"><div className="font-medium">{d.title}</div>{d.job_number && <div className="font-mono text-[11px] text-muted-foreground">{d.job_number}</div>}</td>
                <td className="px-3 py-2.5"><StageBadge stage={d.stage} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(d.estimated_value)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{ownerName(d.owner_id)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.last_activity_at ? `${daysSince(d.last_activity_at)}d ago` : "—"}</td>
                <td className="px-3 py-2.5">{d.next_action ? <div><div className="max-w-[220px] truncate">{d.next_action}</div>{d.next_action_due && <div className={cn("text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>{fmtDate(d.next_action_due)}{overdue ? " · overdue" : ""}</div>}</div> : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Table view (compact, more columns) ───────────────────────────
function TableView({ deals, ownerName, onOpen }: { deals: Deal[]; ownerName: (id: string | null) => string; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Deal</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Job type</th>
            <th className="px-3 py-2 font-medium text-right">Value</th>
            <th className="px-3 py-2 font-medium text-right">Prob.</th>
            <th className="px-3 py-2 font-medium">Close</th>
            <th className="px-3 py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} onClick={() => onOpen(d.id)} className="cursor-pointer border-t border-border transition hover:bg-muted/40">
              <td className="px-3 py-2 font-medium">{d.title}</td>
              <td className="px-3 py-2"><StageBadge stage={d.stage} /></td>
              <td className="px-3 py-2 text-muted-foreground">{ownerName(d.owner_id)}</td>
              <td className="px-3 py-2 text-muted-foreground">{d.job_type || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(d.estimated_value)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{d.probability != null ? `${d.probability}%` : "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(d.expected_close_date)}</td>
              <td className="px-3 py-2 text-muted-foreground">{d.source || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Kanban view (drag a card between stages) ─────────────────────
function KanbanView({ deals, onOpen, canWrite, onMove }: { deals: Deal[]; onOpen: (id: string) => void; canWrite: boolean; onMove: (id: string, to: DealStage) => void }) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<DealStage | null>(null);
  const cols = DEAL_STAGES;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cols.map((s) => {
        const m = DEAL_STAGE_META[s];
        const items = deals.filter((d) => d.stage === s);
        const total = items.reduce((sum, d) => sum + (d.estimated_value ?? 0), 0);
        return (
          <div key={s}
            onDragOver={(e) => { if (canWrite && dragId) { e.preventDefault(); if (overStage !== s) setOverStage(s); } }}
            onDrop={() => { if (canWrite && dragId) onMove(dragId, s); setDragId(null); setOverStage(null); }}
            className={cn("flex w-64 shrink-0 flex-col rounded-lg border bg-muted/20", overStage === s ? "border-accent ring-1 ring-accent" : "border-border")}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[m.tone])}>{m.label}</span>
              <span className="text-[11px] text-muted-foreground">{items.length} · {money(total)}</span>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {items.map((d) => (
                <div key={d.id} draggable={canWrite} onDragStart={() => setDragId(d.id)} onDragEnd={() => { setDragId(null); setOverStage(null); }}
                  onClick={() => onOpen(d.id)}
                  className={cn("cursor-pointer rounded-md border border-border bg-card p-2.5 text-sm shadow-sm transition hover:border-accent/50", dragId === d.id && "opacity-40")}>
                  <div className="font-medium leading-tight">{d.title}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{money(d.estimated_value)}</span>
                    {d.expected_close_date && <span>{fmtDate(d.expected_close_date)}</span>}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="rounded-md border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar view (deals on their expected close date) ───────────
function CalendarView({ deals, onOpen }: { deals: Deal[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = new Date(cursor.y, cursor.m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const byDay = new Map<number, Deal[]>();
  for (const d of deals) {
    if (!d.expected_close_date) continue;
    const dt = new Date(d.expected_close_date);
    if (dt.getFullYear() === cursor.y && dt.getMonth() === cursor.m) {
      const day = dt.getDate();
      byDay.set(day, [...(byDay.get(day) ?? []), d]);
    }
  }
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shift = (delta: number) => setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-lg font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">Today</button>
          <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-muted/50 px-2 py-1.5 text-center font-medium text-muted-foreground">{d}</div>)}
        {cells.map((day, i) => (
          <div key={i} className="min-h-[92px] bg-card p-1.5">
            {day && <div className="mb-1 text-[11px] text-muted-foreground">{day}</div>}
            <div className="space-y-1">
              {(byDay.get(day ?? -1) ?? []).map((d) => (
                <button key={d.id} onClick={() => onOpen(d.id)} className="block w-full truncate rounded bg-accent/15 px-1.5 py-0.5 text-left text-[11px] font-medium text-accent hover:bg-accent/25" title={`${d.title} · ${money(d.estimated_value)}`}>{d.title}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Deals are placed on their expected close date. Set a close date on a deal to see it here.</p>
    </div>
  );
}

// ─── Map view (needs deal geolocation — not captured yet) ─────────
function MapView() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
      <MapIcon className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Map view needs deal locations</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">Deals don&apos;t store a project address/coordinates yet. Once we add a location field to deals (and geocode it, like Jobs), pins will appear here.</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid h-6 w-6 place-items-center rounded-md", TONE_CLASS[tone])}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
// ─── Create-deal modal ────────────────────────────────────────────
function DealFormModal({
  owners, contacts, title, onClose, onSaved,
}: {
  owners: OwnerOption[]; contacts: SourceRow[]; title: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    title: "", contact_id: "", owner_id: "", source: "", estimated_value: "",
    target_start_date: "", next_action: "", next_action_due: "", notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError(null);
    const payload = {
      title: form.title,
      contact_id: form.contact_id || null,
      owner_id: form.owner_id || null,
      source: form.source || null,
      estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value),
      target_start_date: form.target_start_date || null,
      next_action: form.next_action || null,
      next_action_due: form.next_action_due || null,
      notes: form.notes || null,
    };
    const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to create deal."); return; }
    await onSaved();
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Deal title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Waters Residence — Kitchen remodel" /></Field>
        <Field label="Contact">
          <SearchableSelect
            value={form.contact_id}
            onChange={(v) => set("contact_id", v)}
            options={contacts.map((c) => ({ value: c.id, label: c.label, sublabel: c.sub }))}
            placeholder="Search contacts…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            <Select value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">Unassigned</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">—</option>
              {DEAL_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Estimated value"><MoneyInput value={form.estimated_value} onChange={(v) => set("estimated_value", v)} /></Field>
          <Field label="Target start date"><Input type="date" value={form.target_start_date} onChange={(e) => set("target_start_date", e.target.value)} /></Field>
          <Field label="Next action"><Input value={form.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="e.g. Call to schedule site visit" /></Field>
          <Field label="Next action due"><Input type="date" value={form.next_action_due} onChange={(e) => set("next_action_due", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[70px]" /></Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Deal</Button>
      </div>
    </ModalShell>
  );
}

// ─── Add-to-Pipeline modal (multi-select from a source) ───────────
function AddToPipelineModal({
  contacts, quotes, submissions, deals, onClose, onAdded,
}: {
  contacts: SourceRow[]; quotes: SourceRow[]; submissions: SourceRow[]; deals: Deal[];
  onClose: () => void; onAdded: () => Promise<void>;
}) {
  const [sourceType, setSourceType] = React.useState<"contact" | "quote" | "contact_submission">("contact");
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const rows = sourceType === "contact" ? contacts : sourceType === "quote" ? quotes : submissions;
  const alreadyIn = React.useMemo(
    () => new Set(deals.filter((d) => d.source_type === sourceType && d.source_id).map((d) => d.source_id as string)),
    [deals, sourceType],
  );
  const filtered = rows.filter((r) => !query || `${r.label} ${r.sub}`.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function switchSource(t: typeof sourceType) { setSourceType(t); setPicked(new Set()); setQuery(""); }

  async function submit() {
    if (!picked.size) return;
    setSaving(true);
    const res = await fetch("/api/deals/add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_type: sourceType, ids: Array.from(picked) }),
    });
    setSaving(false);
    if (res.ok) await onAdded();
  }

  const TABS = [
    { key: "contact" as const, label: "Contacts" },
    { key: "quote" as const, label: "Leads" },
    { key: "contact_submission" as const, label: "Form Submissions" },
  ];

  return (
    <ModalShell title="Add to Pipeline" onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchSource(t.key)}
            className={cn("border-b-2 px-3 py-2 text-sm font-medium transition", sourceType === t.key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-8" />
      </div>
      <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show.</p>
        ) : filtered.map((r) => {
          const inPipeline = alreadyIn.has(r.id);
          const checked = picked.has(r.id);
          return (
            <label key={r.id} className={cn("flex items-center gap-3 border-b border-border px-3 py-2 last:border-0", inPipeline ? "opacity-50" : "cursor-pointer hover:bg-muted/40")}>
              <input type="checkbox" disabled={inPipeline} checked={checked} onChange={() => toggle(r.id)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.label}</div>
                {r.sub && <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>}
              </div>
              {inPipeline && <span className="shrink-0 text-[11px] text-muted-foreground">In pipeline</span>}
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{picked.size} selected</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} disabled={saving || !picked.size}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add {picked.size || ""} to Pipeline
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn("max-h-[90vh] w-full overflow-auto rounded-xl bg-card p-5 shadow-xl", wide ? "max-w-2xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
