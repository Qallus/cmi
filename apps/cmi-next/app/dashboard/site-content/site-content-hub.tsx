"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen, ChevronDown, ClipboardList, LayoutGrid, List, Loader2, Monitor,
  MonitorSmartphone, RefreshCw, Sparkles, Table as TableIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteContentClient } from "./site-content-client";
import { NoteDetailModal } from "@/components/dashboard/note-detail-modal";
import type { ContentBlock } from "./page";
import { SESSION_STATUSES, SESSION_STATUS_LABELS, type SessionStatus, type SessionSummary } from "@/lib/live-editor/types";
import { NOTE_STATUSES, NOTE_STATUS_LABELS, NOTE_TYPE_LABELS, type DashboardNote, type DashboardNoteStatus } from "@/lib/dashboard-notes/types";

type Surface = "frontend" | "backend";
type View = "cards" | "list" | "table";

// A request normalized across the two systems (Live Page Editor + dashboard FAB).
type Req = {
  id: string;
  surface: Surface;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  priority: string | null;
  meta: string;        // "3 notes" | note type
  updated: string;
  openHref: string;
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-info/15 text-info", in_progress: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success", done: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};
const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive",
};
const isDone = (s: string) => s === "resolved" || s === "done";
const isOpen = (s: string) => s === "open";
const isProgress = (s: string) => s === "in_progress";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return iso; }
}

export function SiteContentHub({ initialBlocks }: { initialBlocks: ContentBlock[] }) {
  const [role, setRole] = React.useState<string | null>(null);
  const isSuperAdmin = role === "super_admin";

  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [notes, setNotes] = React.useState<DashboardNote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [surface, setSurface] = React.useState<Surface>("frontend");
  const [view, setView] = React.useState<View>("cards");
  const [blocksOpen, setBlocksOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json())
      .then((d: { user?: { role?: string } | null }) => setRole(d.user?.role ?? null)).catch(() => {});
  }, []);

  const loadRequests = React.useCallback(async () => {
    setLoading(true);
    try {
      const [fr, bk] = await Promise.all([
        fetch("/api/site-content/live-editor?list=sessions").then((r) => r.ok ? r.json() : { sessions: [] }),
        fetch("/api/dashboard-notes?scope=all").then((r) => r.ok ? r.json() : { notes: [] }),
      ]);
      setSessions((fr.sessions ?? []) as SessionSummary[]);
      setNotes((bk.notes ?? []) as DashboardNote[]);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { if (isSuperAdmin) void loadRequests(); }, [isSuperAdmin, loadRequests]);

  const frontendReqs: Req[] = React.useMemo(() => sessions.map((s) => ({
    id: s.session.id, surface: "frontend",
    title: s.session.page_title ?? s.session.page_slug,
    subtitle: s.session.page_url ?? s.session.page_slug,
    status: s.session.status, statusLabel: SESSION_STATUS_LABELS[(s.session.status as SessionStatus)] ?? s.session.status,
    priority: s.top_priority, meta: `${s.note_count} note${s.note_count !== 1 ? "s" : ""}`,
    updated: s.last_activity, openHref: `/dashboard/site-content/live-editor?page=${encodeURIComponent(s.session.page_slug)}`,
  })), [sessions]);

  const backendReqs: Req[] = React.useMemo(() => notes.map((n) => ({
    id: n.id, surface: "backend",
    title: n.page_title ?? "Dashboard", subtitle: n.note,
    status: n.status, statusLabel: NOTE_STATUS_LABELS[(n.status as DashboardNoteStatus)] ?? n.status,
    priority: n.priority, meta: NOTE_TYPE_LABELS[n.type] ?? n.type,
    updated: n.updated_at, openHref: n.route ?? "/dashboard/overview",
  })), [notes]);

  const all = React.useMemo(() => [...frontendReqs, ...backendReqs], [frontendReqs, backendReqs]);
  const stats = React.useMemo(() => ({
    total: all.length,
    open: all.filter((r) => isOpen(r.status)).length,
    progress: all.filter((r) => isProgress(r.status)).length,
    done: all.filter((r) => isDone(r.status)).length,
    urgent: all.filter((r) => r.priority === "urgent").length,
    frontend: frontendReqs.length,
    backend: backendReqs.length,
  }), [all, frontendReqs, backendReqs]);

  const shown = surface === "frontend" ? frontendReqs : backendReqs;

  async function deleteReq(r: Req) {
    if (!window.confirm(`Delete this ${r.surface === "frontend" ? "page review" : "request"}? This can't be undone.`)) return;
    if (r.surface === "frontend") {
      setSessions((prev) => prev.filter((s) => s.session.id !== r.id));
      await fetch("/api/site-content/live-editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_session", id: r.id }) }).catch(() => {});
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== r.id));
      await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: r.id }) }).catch(() => {});
    }
  }

  async function setStatus(r: Req, status: string) {
    if (r.surface === "frontend") {
      setSessions((prev) => prev.map((s) => (s.session.id === r.id ? { ...s, session: { ...s.session, status } } : s)));
      await fetch("/api/site-content/live-editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_session", id: r.id, patch: { status } }) }).catch(() => {});
    } else {
      setNotes((prev) => prev.map((n) => (n.id === r.id ? { ...n, status: status as DashboardNoteStatus } : n)));
      await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_status", id: r.id, status }) }).catch(() => {});
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Website Hub</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Site Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">The gateway for all website updates — frontend pages and the dashboard. Review requests, edit content, and hand work to Bolt.</p>
      </div>

      {/* Stats */}
      {isSuperAdmin && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total requests" value={stats.total} />
          <Stat label="Open" value={stats.open} tone="info" />
          <Stat label="In progress" value={stats.progress} tone="warning" />
          <Stat label="Completed" value={stats.done} tone="success" />
          <Stat label="Urgent" value={stats.urgent} tone="danger" />
        </div>
      )}

      {/* Launch tiles */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isSuperAdmin && (
          <Tile href="/dashboard/site-content/live-editor" icon={<MonitorSmartphone className="h-5 w-5" />} title="Live Page Editor" desc="Visually review frontend pages, click elements, and request edits." />
        )}
        <Tile href="/dashboard/agent" icon={<Sparkles className="h-5 w-5" />} title="Bolt AI" desc="Ask Bolt to look up, draft, and prepare changes across the app." />
        <button type="button" onClick={() => setBlocksOpen((v) => !v)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-accent/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><BookOpen className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold">Content Blocks</span><span className="mt-0.5 block text-xs text-muted-foreground">Edit hero / CTA / banner content shown on the public site.</span></span>
          <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition", blocksOpen && "rotate-180")} />
        </button>
      </div>

      {/* Requests hub */}
      {isSuperAdmin ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Requests</h2>
              <div className="ml-2 inline-flex rounded-md border border-border p-0.5">
                <TabBtn active={surface === "frontend"} onClick={() => setSurface("frontend")} icon={<Monitor className="h-3.5 w-3.5" />} label={`Frontend (${stats.frontend})`} />
                <TabBtn active={surface === "backend"} onClick={() => setSurface("backend")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label={`Dashboard (${stats.backend})`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-border p-0.5">
                {([["cards", LayoutGrid], ["list", List], ["table", TableIcon]] as const).map(([v, Icon]) => (
                  <button key={v} type="button" title={v} onClick={() => setView(v)} className={cn("inline-flex h-7 w-7 items-center justify-center rounded", view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /></button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadRequests()}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : shown.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                {surface === "frontend"
                  ? <>No frontend requests yet. Open the <Link href="/dashboard/site-content/live-editor" className="font-medium text-accent">Live Page Editor</Link> to add some.</>
                  : <>No dashboard requests yet. Use the review button (bottom-right of any page) to capture one.</>}
              </div>
            ) : view === "cards" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((r) => <ReqCard key={r.id} r={r} onStatus={setStatus} onOpen={setDetailId} onDelete={deleteReq} />)}</div>
            ) : view === "list" ? (
              <div className="space-y-2">{shown.map((r) => <ReqRow key={r.id} r={r} onStatus={setStatus} onOpen={setDetailId} onDelete={deleteReq} />)}</div>
            ) : (
              <ReqTable reqs={shown} onStatus={setStatus} onOpen={setDetailId} onDelete={deleteReq} />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">The request review hub is available to Super Admins.</div>
      )}

      {/* Content Blocks (collapsible) */}
      {blocksOpen && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <SiteContentClient initialBlocks={initialBlocks} />
        </div>
      )}

      {detailId && <NoteDetailModal noteId={detailId} onClose={() => setDetailId(null)} onChanged={() => void loadRequests()} />}
    </div>
  );
}

// Open control: backend requests open the detail modal; frontend navigate to the editor.
function OpenBtn({ r, onOpen }: { r: Req; onOpen: (id: string) => void }) {
  if (r.surface === "backend") {
    return <button type="button" onClick={() => onOpen(r.id)} className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-[11px] font-medium text-accent-foreground hover:opacity-90">Open</button>;
  }
  return <a href={r.openHref} className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-[11px] font-medium text-accent-foreground hover:opacity-90">Open</a>;
}

function statusOptions(surface: Surface) {
  return surface === "frontend"
    ? SESSION_STATUSES.map((s) => ({ value: s, label: SESSION_STATUS_LABELS[s] }))
    : NOTE_STATUSES.map((s) => ({ value: s, label: NOTE_STATUS_LABELS[s] }));
}

function StatusPicker({ r, onStatus }: { r: Req; onStatus: (r: Req, s: string) => void }) {
  return (
    <select value={r.status} onChange={(e) => onStatus(r, e.target.value)} className={cn("h-7 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium outline-none", STATUS_TONE[r.status])}>
      {statusOptions(r.surface).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DeleteBtn({ r, onDelete }: { r: Req; onDelete: (r: Req) => void }) {
  return <button type="button" onClick={() => onDelete(r)} title="Delete request" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>;
}

function ReqCard({ r, onStatus, onOpen, onDelete }: { r: Req; onStatus: (r: Req, s: string) => void; onOpen: (id: string) => void; onDelete: (r: Req) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-sm font-medium">{r.title}</div><div className="truncate text-[11px] text-muted-foreground">{r.subtitle}</div></div>
        {r.priority && <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[r.priority])}>{r.priority}</span>}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span>{r.meta}</span><span>· {fmt(r.updated)}</span></div>
      <div className="flex items-center gap-2">
        <OpenBtn r={r} onOpen={onOpen} />
        <StatusPicker r={r} onStatus={onStatus} />
        <div className="ml-auto"><DeleteBtn r={r} onDelete={onDelete} /></div>
      </div>
    </div>
  );
}

function ReqRow({ r, onStatus, onOpen, onDelete }: { r: Req; onStatus: (r: Req, s: string) => void; onOpen: (id: string) => void; onDelete: (r: Req) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="min-w-[160px] flex-1"><div className="text-sm font-medium">{r.title}</div><div className="truncate text-[11px] text-muted-foreground">{r.subtitle}</div></div>
      {r.priority && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[r.priority])}>{r.priority}</span>}
      <span className="text-[11px] text-muted-foreground">{r.meta}</span>
      <OpenBtn r={r} onOpen={onOpen} />
      <StatusPicker r={r} onStatus={onStatus} />
      <DeleteBtn r={r} onDelete={onDelete} />
    </div>
  );
}

function ReqTable({ reqs, onStatus, onOpen, onDelete }: { reqs: Req[]; onStatus: (r: Req, s: string) => void; onOpen: (id: string) => void; onDelete: (r: Req) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-left">{["Request", "Detail", "Priority", "Status", "Updated", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium">{r.title}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground"><div className="max-w-[240px] truncate">{r.subtitle}</div><div className="text-[11px]">{r.meta}</div></td>
              <td className="px-4 py-2.5">{r.priority && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[r.priority])}>{r.priority}</span>}</td>
              <td className="px-4 py-2.5"><StatusPicker r={r} onStatus={onStatus} /></td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmt(r.updated)}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {r.surface === "backend"
                    ? <button type="button" onClick={() => onOpen(r.id)} className="text-[11px] font-medium text-accent">Open →</button>
                    : <a href={r.openHref} className="text-[11px] font-medium text-accent">Open →</a>}
                  <DeleteBtn r={r} onDelete={onDelete} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "info" | "warning" | "success" | "danger" }) {
  const toneCls = tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className={cn("text-2xl font-semibold tabular-nums", toneCls)}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Tile({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-accent/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span></span>
    </Link>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{icon} {label}</button>;
}
