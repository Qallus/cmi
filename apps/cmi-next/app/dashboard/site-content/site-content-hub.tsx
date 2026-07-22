"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Columns3, ExternalLink, LayoutGrid, List, Loader2, Monitor,
  MonitorSmartphone, RefreshCw, Sparkles, Table as TableIcon, Trash2, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteContentClient } from "./site-content-client";
import { NoteDetailModal } from "@/components/dashboard/note-detail-modal";
import { ConfirmDeleteDialog } from "@/components/dashboard/confirm-delete-dialog";
import type { ContentBlock } from "./page";
import { SESSION_STATUSES, SESSION_STATUS_LABELS, type SessionStatus, type SessionSummary } from "@/lib/live-editor/types";
import { NOTE_STATUSES, NOTE_STATUS_LABELS, NOTE_TYPE_LABELS, type DashboardNote, type DashboardNoteStatus } from "@/lib/dashboard-notes/types";

type Surface = "frontend" | "backend";
type Tab = Surface | "resolved";
type View = "cards" | "list" | "table" | "kanban" | "calendar";

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
  requester: string | null;  // who asked for the change
  created: string;           // when the request was made
  updated: string;
  openHref: string;
  screenshot: string | null;
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
function fmtDateTime(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}
/** Show the requester's first name to keep the row compact. */
function firstName(name: string | null): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] || name;
}

export function SiteContentHub({ initialBlocks }: { initialBlocks: ContentBlock[] }) {
  const [role, setRole] = React.useState<string | null>(null);
  const isSuperAdmin = role === "super_admin";

  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [notes, setNotes] = React.useState<DashboardNote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("frontend");
  const [view, setView] = React.useState<View>("cards");
  // Resolved starts on its list view; the two active tabs default to cards.
  const [resolvedView, setResolvedView] = React.useState<View>("list");
  const [blocksOpen, setBlocksOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Req | null>(null);

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

  const frontendReqs: Req[] = React.useMemo(() => sessions.filter((s) => s.session.status !== "archived").map((s) => ({
    id: s.session.id, surface: "frontend",
    title: s.session.page_title ?? s.session.page_slug,
    subtitle: s.session.page_url ?? s.session.page_slug,
    status: s.session.status, statusLabel: SESSION_STATUS_LABELS[(s.session.status as SessionStatus)] ?? s.session.status,
    priority: s.top_priority, meta: `${s.note_count} note${s.note_count !== 1 ? "s" : ""}`,
    requester: s.session.requester_name, created: s.session.created_at,
    updated: s.last_activity, openHref: `/dashboard/site-content/live-editor?page=${encodeURIComponent(s.session.page_slug)}`,
    screenshot: null,
  })), [sessions]);

  const backendReqs: Req[] = React.useMemo(() => notes.filter((n) => n.status !== "archived").map((n) => ({
    id: n.id, surface: "backend",
    title: n.page_title ?? "Dashboard", subtitle: n.note,
    status: n.status, statusLabel: NOTE_STATUS_LABELS[(n.status as DashboardNoteStatus)] ?? n.status,
    priority: n.priority, meta: NOTE_TYPE_LABELS[n.type] ?? n.type,
    requester: n.created_by_name, created: n.created_at,
    updated: n.updated_at, openHref: n.route ?? "/dashboard/overview",
    screenshot: n.screenshot_url,
  })), [notes]);

  // Resolved/completed requests move out of their source tab and into Resolved.
  const activeFrontend = React.useMemo(() => frontendReqs.filter((r) => !isDone(r.status)), [frontendReqs]);
  const activeBackend = React.useMemo(() => backendReqs.filter((r) => !isDone(r.status)), [backendReqs]);
  const resolvedReqs = React.useMemo(
    () => [...frontendReqs, ...backendReqs].filter((r) => isDone(r.status)).sort((a, b) => (a.updated < b.updated ? 1 : -1)),
    [frontendReqs, backendReqs],
  );

  const all = React.useMemo(() => [...frontendReqs, ...backendReqs], [frontendReqs, backendReqs]);
  const stats = React.useMemo(() => ({
    total: all.length,
    open: all.filter((r) => isOpen(r.status)).length,
    progress: all.filter((r) => isProgress(r.status)).length,
    done: all.filter((r) => isDone(r.status)).length,
    urgent: all.filter((r) => r.priority === "urgent").length,
    frontend: activeFrontend.length,
    backend: activeBackend.length,
    resolved: resolvedReqs.length,
  }), [all, activeFrontend, activeBackend, resolvedReqs]);

  const shown = tab === "frontend" ? activeFrontend : tab === "backend" ? activeBackend : resolvedReqs;
  const activeView = tab === "resolved" ? resolvedView : view;
  const setActiveView = tab === "resolved" ? setResolvedView : setView;

  async function hardDelete(r: Req) {
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
              <div className="ml-2 inline-flex flex-wrap rounded-md border border-border p-0.5">
                <TabBtn active={tab === "frontend"} onClick={() => setTab("frontend")} icon={<Monitor className="h-3.5 w-3.5" />} label={`Frontend (${stats.frontend})`} />
                <TabBtn active={tab === "backend"} onClick={() => setTab("backend")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label={`Dashboard (${stats.backend})`} />
                <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")} icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={`Resolved (${stats.resolved})`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-border p-0.5">
                {(tab === "resolved"
                  ? ([["list", List], ["table", TableIcon], ["kanban", Columns3], ["calendar", CalendarDays]] as const)
                  : ([["cards", LayoutGrid], ["list", List], ["table", TableIcon]] as const)
                ).map(([v, Icon]) => (
                  <button key={v} type="button" title={v} onClick={() => setActiveView(v)} className={cn("inline-flex h-7 w-7 items-center justify-center rounded", activeView === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /></button>
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
                {tab === "frontend"
                  ? <>No open frontend requests. Open the <Link href="/dashboard/site-content/live-editor" className="font-medium text-accent">Live Page Editor</Link> to add some.</>
                  : tab === "backend"
                  ? <>No open dashboard requests. Use the review button (bottom-right of any page) to capture one.</>
                  : <>Nothing resolved yet. Requests land here once you mark them Complete or Done.</>}
              </div>
            ) : activeView === "cards" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((r) => <ReqCard key={r.id} r={r} onStatus={setStatus} onOpen={setDetailId} onDelete={setConfirmDel} />)}</div>
            ) : activeView === "list" ? (
              <div className="space-y-2">{shown.map((r) => <ReqRow key={r.id} r={r} onStatus={setStatus} onOpen={setDetailId} onDelete={setConfirmDel} />)}</div>
            ) : activeView === "table" ? (
              <ReqTable reqs={shown} onStatus={setStatus} onOpen={setDetailId} onDelete={setConfirmDel} />
            ) : activeView === "kanban" ? (
              <KanbanView reqs={shown} onStatus={setStatus} onOpen={setDetailId} onDelete={setConfirmDel} />
            ) : (
              <CalendarView reqs={shown} onOpen={setDetailId} />
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

      {confirmDel && (
        <ConfirmDeleteDialog
          itemName={confirmDel.surface === "frontend" ? "this page review" : "this request"}
          onConfirm={async () => { const r = confirmDel; setConfirmDel(null); await hardDelete(r); }}
          onArchive={async () => { const r = confirmDel; setConfirmDel(null); await setStatus(r, "archived"); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
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

// A screenshot thumbnail that opens an in-app lightbox (with a close X) instead
// of navigating to the raw image — so the user can always get back.
function ScreenshotThumb({ src, wrapClass, imgClass }: { src: string; wrapClass: string; imgClass: string }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={cn(wrapClass, "cursor-zoom-in")} title="Click to enlarge">
        <img src={src} alt="" className={imgClass} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" title="Close (Esc)" aria-label="Close screenshot"><X className="h-5 w-5" /></button>
          <img src={src} alt="Screenshot" className="max-h-[92vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
          <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20">Open original <ExternalLink className="h-3 w-3" /></a>
        </div>
      )}
    </>
  );
}

function ReqCard({ r, onStatus, onOpen, onDelete }: { r: Req; onStatus: (r: Req, s: string) => void; onOpen: (id: string) => void; onDelete: (r: Req) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      {r.screenshot && <ScreenshotThumb src={r.screenshot} wrapClass="block overflow-hidden rounded-md border border-border" imgClass="h-32 w-full object-cover object-top" />}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-sm font-medium">{r.title}</div><div className="truncate text-[11px] text-muted-foreground">{r.subtitle}</div></div>
        {r.priority && <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[r.priority])}>{r.priority}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{r.meta}</span>
        {r.requester && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{firstName(r.requester)}</span>}
        <span title={`Requested ${fmtDateTime(r.created)}`}>· {fmtDateTime(r.created)}</span>
      </div>
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
      {r.screenshot && <ScreenshotThumb src={r.screenshot} wrapClass="shrink-0" imgClass="h-10 w-16 rounded border border-border object-cover object-top" />}
      <div className="min-w-[160px] flex-1"><div className="text-sm font-medium">{r.title}</div><div className="truncate text-[11px] text-muted-foreground">{r.subtitle}</div></div>
      {r.priority && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[r.priority])}>{r.priority}</span>}
      {r.requester && <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex"><User className="h-3 w-3" />{firstName(r.requester)}</span>}
      <span className="hidden text-[11px] text-muted-foreground md:inline" title={`Requested ${fmtDateTime(r.created)}`}>{fmtDateTime(r.created)}</span>
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
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-left">{["Request", "Detail", "Requested by", "Requested", "Priority", "Status", "Updated", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {r.screenshot && <ScreenshotThumb src={r.screenshot} wrapClass="" imgClass="h-9 w-14 rounded border border-border object-cover object-top" />}
                  <span className="font-medium">{r.title}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground"><div className="max-w-[240px] truncate">{r.subtitle}</div><div className="text-[11px]">{r.meta}</div></td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.requester ?? "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground" title={fmtDateTime(r.created)}>{fmtDateTime(r.created)}</td>
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

// ── Kanban (Resolved tab) — columns by priority ──
const PRIORITY_ORDER: { key: string; label: string }[] = [
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "none", label: "No priority" },
];

function KanbanView({ reqs, onStatus, onOpen, onDelete }: { reqs: Req[]; onStatus: (r: Req, s: string) => void; onOpen: (id: string) => void; onDelete: (r: Req) => void }) {
  const columns = PRIORITY_ORDER.map((col) => ({
    ...col,
    items: reqs.filter((r) => (r.priority ?? "none") === col.key),
  })).filter((col) => col.items.length > 0);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">{col.label}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {col.items.map((r) => <ReqCard key={r.id} r={r} onStatus={onStatus} onOpen={onOpen} onDelete={onDelete} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Calendar (Resolved tab) — placed on the day each request was resolved ──
function CalendarView({ reqs, onOpen }: { reqs: Req[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = React.useMemo(() => {
    const map = new Map<string, Req[]>();
    for (const r of reqs) {
      const d = new Date(r.updated);
      if (Number.isNaN(d.getTime())) continue;
      const k = key(d);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    return map;
  }, [reqs]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const leadBlanks = first.getDay();
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const cells: (number | null)[] = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const step = (delta: number) => setCursor((c) => {
    const m = c.m + delta;
    return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-24 bg-background" />;
          const items = byDay.get(`${cursor.y}-${cursor.m}-${day}`) ?? [];
          const isToday = today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === day;
          return (
            <div key={day} className="min-h-24 bg-background p-1.5">
              <div className={cn("mb-1 text-[11px] font-medium", isToday ? "text-accent" : "text-muted-foreground")}>{day}</div>
              <div className="space-y-1">
                {items.slice(0, 4).map((r) => (
                  r.surface === "backend"
                    ? <button key={r.id} type="button" onClick={() => onOpen(r.id)} title={r.title} className="block w-full truncate rounded bg-success/10 px-1.5 py-0.5 text-left text-[10px] text-success hover:bg-success/20">{r.title}</button>
                    : <a key={r.id} href={r.openHref} title={r.title} className="block truncate rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success hover:bg-success/20">{r.title}</a>
                ))}
                {items.length > 4 && <div className="px-1.5 text-[10px] text-muted-foreground">+{items.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
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
