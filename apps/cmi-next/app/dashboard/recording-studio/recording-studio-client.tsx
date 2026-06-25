"use client";

import * as React from "react";
import {
  Mic, Plus, RefreshCw, Search, Eye, FileAudio, Image as ImageIcon, Sparkles, Archive,
  RotateCcw, Trash2, Play, FileText, List as ListIcon, Table as TableIcon, LayoutGrid,
  Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { AudioPlayer } from "@/components/audio/audio-player";
import { cn } from "@/lib/utils";
import { MEETING_TYPES, MEETING_TYPE_LABELS, typeColor, type MeetingListItem, type MeetingStatus } from "@/lib/meetings/types";
import { MeetingDetail, type LinkOption } from "./meeting-detail";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", processing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  transcribed: "bg-blue-500/15 text-blue-600 dark:text-blue-400", reviewed: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  action_items_created: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", shared_with_client: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", processing: "Processing", transcribed: "Transcribed", reviewed: "Reviewed",
  action_items_created: "Action items", shared_with_client: "Shared", archived: "Archived",
};
type ViewMode = "table" | "list" | "card" | "calendar";

function recCount(m: MeetingListItem) { return (m.recordings?.length || (m.recording_path ? 1 : 0)); }
function firstPath(m: MeetingListItem) { return m.recordings?.[0]?.path || m.recording_path || null; }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function RecordingStudioClient() {
  const [meetings, setMeetings] = React.useState<MeetingListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [view, setView] = React.useState<ViewMode>("table");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [options, setOptions] = React.useState<{ contacts: LinkOption[]; projects: LinkOption[]; quotes: LinkOption[]; staff: LinkOption[] }>({ contacts: [], projects: [], quotes: [], staff: [] });

  // shared drawer + transcript modal
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [track, setTrack] = React.useState<{ url: string; filename: string } | null>(null);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [transcript, setTranscript] = React.useState<{ title: string; text: string; loading: boolean }>({ title: "", text: "", loading: false });
  const [monthCursor, setMonthCursor] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (typeFilter) qs.set("type", typeFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/meetings?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setMeetings(json.meetings ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load meetings."); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    function norm(j: unknown, labeler: (r: Record<string, unknown>) => string): LinkOption[] {
      const arr = Array.isArray(j) ? j : ((j as Record<string, unknown>)?.contacts || (j as Record<string, unknown>)?.items || (j as Record<string, unknown>)?.quotes || (j as Record<string, unknown>)?.staff || []);
      return (arr as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: labeler(r) }));
    }
    (async () => {
      try {
        const [c, p, q, s] = await Promise.all([
          fetch("/api/contacts").then((r) => r.ok ? r.json() : []),
          fetch("/api/project-manager/schedule?board_id=default").then((r) => r.ok ? r.json() : []),
          fetch("/api/quotes").then((r) => r.ok ? r.json() : []),
          fetch("/api/staff-options").then((r) => r.ok ? r.json() : []),
        ]);
        setOptions({
          contacts: norm(c, (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || String(r.email ?? "Contact")),
          projects: norm(p, (r) => String(r.title ?? r.project_title ?? "Project")),
          quotes: norm(q, (r) => String(r.name ?? "Quote")),
          staff: norm(s, (r) => String(r.label ?? r.display_name ?? "Staff")),
        });
      } catch { /* options optional */ }
    })();
  }, []);

  async function createMeeting() {
    setCreating(true);
    try {
      const res = await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Untitled meeting", meeting_type: "client_meeting", status: "draft", meeting_date: new Date().toISOString() }) });
      const json = await res.json();
      if (res.ok && json.meeting) setSelectedId(json.meeting.id);
    } finally { setCreating(false); }
  }
  async function listen(m: MeetingListItem) {
    const path = firstPath(m); if (!path) return;
    const res = await fetch(`/api/meetings/${m.id}/playback?path=${encodeURIComponent(path)}`).then((r) => r.json()).catch(() => null);
    if (res?.url) { setTrack({ url: res.url, filename: m.recordings?.[0]?.filename || m.recording_filename || "recording" }); setDrawerOpen(true); }
  }
  async function showTranscript(m: MeetingListItem) {
    setTranscript({ title: m.title, text: "", loading: true }); setTranscriptOpen(true);
    const res = await fetch(`/api/meetings/${m.id}`).then((r) => r.json()).catch(() => null);
    setTranscript({ title: m.title, text: res?.meeting?.transcript || "No transcript yet.", loading: false });
  }
  async function setStatus(meetingId: string, status: string) {
    await fetch(`/api/meetings/${meetingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }
  async function remove(meetingId: string) {
    if (!window.confirm("Delete this meeting and its recordings? This cannot be undone.")) return;
    await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  if (selectedId) {
    return <MeetingDetail id={selectedId} options={options} onBack={() => { setSelectedId(null); load(); }} onDeleted={() => { setSelectedId(null); load(); }} />;
  }

  const VIEWS: [ViewMode, string, React.ElementType][] = [["table", "Table", TableIcon], ["list", "List", ListIcon], ["card", "Cards", LayoutGrid], ["calendar", "Calendar", CalendarIcon]];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <h1 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"><Mic className="h-5 w-5 text-accent" /> Recording Studio</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {VIEWS.map(([v, label, Icon]) => (
              <button key={v} onClick={() => setView(v)} title={label} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>
          <Button size="sm" variant="accent" onClick={createMeeting} disabled={creating}><Plus className="h-3.5 w-3.5" /> New recording</Button>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-56"><Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="pl-8" /></div>
          <div className="w-40"><Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{MEETING_TYPES.map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}</Select></div>
          <div className="w-40"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select></div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {loading && !meetings.length ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : meetings.length === 0 && view !== "calendar" ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <Mic className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No recordings yet</p>
            <Button size="sm" variant="accent" className="mt-4" onClick={createMeeting}><Plus className="h-3.5 w-3.5" /> New recording</Button>
          </div>
        ) : (
          <>
            {view === "table" && <TableView meetings={meetings} onOpen={setSelectedId} onListen={listen} onTranscript={showTranscript} onStatus={setStatus} onRemove={remove} />}
            {view === "list" && <ListView meetings={meetings} onOpen={setSelectedId} onListen={listen} onTranscript={showTranscript} />}
            {view === "card" && <CardView meetings={meetings} onOpen={setSelectedId} onListen={listen} onTranscript={showTranscript} />}
            {view === "calendar" && <CalendarView meetings={meetings} cursor={monthCursor} setCursor={setMonthCursor} onOpen={setSelectedId} />}
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Now playing" description={track?.filename}>
        {track && <AudioPlayer key={track.url} src={track.url} filename={track.filename} />}
        <div className="mt-4 flex justify-end"><Button size="sm" variant="outline" onClick={() => setDrawerOpen(false)}>Close</Button></div>
      </Drawer>

      {transcriptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setTranscriptOpen(false)} />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-accent" /> {transcript.title} — Transcript</div>
              <button onClick={() => setTranscriptOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 text-sm leading-relaxed whitespace-pre-wrap">
              {transcript.loading ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</span> : transcript.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared per-item action buttons ─────────────────────────────────────────────
function Actions({ m, onListen, onTranscript, compact }: { m: MeetingListItem; onListen: (m: MeetingListItem) => void; onTranscript: (m: MeetingListItem) => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {recCount(m) > 0 && <button onClick={() => onListen(m)} title="Listen" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-accent"><Play className="h-4 w-4" /></button>}
      <button onClick={() => onTranscript(m)} title="Transcript" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><FileText className="h-4 w-4" /></button>
      {!compact && <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><FileAudio className="h-3 w-3" />{recCount(m)}</span>}
    </div>
  );
}
function StatusPill({ s }: { s: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[s as MeetingStatus] || STATUS_STYLE.draft)}>{STATUS_LABEL[s] || s}</span>;
}
function Thumb({ m, size = "h-10 w-10" }: { m: MeetingListItem; size?: string }) {
  return m.image_url
    ? <img src={m.image_url} alt="" className={cn("rounded object-cover", size)} />
    : <div className={cn("grid place-items-center rounded bg-muted text-muted-foreground", size)}><ImageIcon className="h-4 w-4" /></div>;
}

function TableView({ meetings, onOpen, onListen, onTranscript, onStatus, onRemove }: {
  meetings: MeetingListItem[]; onOpen: (id: string) => void; onListen: (m: MeetingListItem) => void; onTranscript: (m: MeetingListItem) => void; onStatus: (id: string, s: string) => void; onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <th className="px-4 py-3">Meeting</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">When</th><th className="px-4 py-3">Recordings</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {meetings.map((m) => (
            <tr key={m.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpen(m.id)}>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><Thumb m={m} /><div className="min-w-0"><div className="font-medium">{m.title}</div>{m.summary && <div className="line-clamp-1 text-xs text-muted-foreground">{m.summary}</div>}</div></div></td>
              <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", typeColor(m.meeting_type))}>{MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtDate(m.meeting_date)}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><FileAudio className="h-3.5 w-3.5" />{recCount(m)}</span></td>
              <td className="px-4 py-3"><StatusPill s={m.status} /></td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <Actions m={m} onListen={onListen} onTranscript={onTranscript} compact />
                  <button onClick={() => onOpen(m.id)} title="Open" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
                  {m.status === "archived"
                    ? <button onClick={() => onStatus(m.id, "reviewed")} title="Restore" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>
                    : <button onClick={() => onStatus(m.id, "archived")} title="Archive" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Archive className="h-4 w-4" /></button>}
                  <button onClick={() => onRemove(m.id)} title="Delete" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ meetings, onOpen, onListen, onTranscript }: { meetings: MeetingListItem[]; onOpen: (id: string) => void; onListen: (m: MeetingListItem) => void; onTranscript: (m: MeetingListItem) => void }) {
  return (
    <div className="space-y-2">
      {meetings.map((m) => (
        <div key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/30" onClick={() => onOpen(m.id)}>
          <Thumb m={m} size="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="truncate font-medium">{m.title}</span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", typeColor(m.meeting_type))}>{MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}</span><StatusPill s={m.status} /></div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{fmtDate(m.meeting_date)}</span><span className="inline-flex items-center gap-0.5"><FileAudio className="h-3 w-3" />{recCount(m)}</span></div>
          </div>
          <Actions m={m} onListen={onListen} onTranscript={onTranscript} compact />
        </div>
      ))}
    </div>
  );
}

function CardView({ meetings, onOpen, onListen, onTranscript }: { meetings: MeetingListItem[]; onOpen: (id: string) => void; onListen: (m: MeetingListItem) => void; onTranscript: (m: MeetingListItem) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meetings.map((m) => (
        <div key={m.id} className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card hover:shadow-md" onClick={() => onOpen(m.id)}>
          <div className="relative h-32 bg-muted">
            {m.image_url ? <img src={m.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Mic className="h-8 w-8" /></div>}
            <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium", typeColor(m.meeting_type))}>{MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}</span>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <div className="font-medium">{m.title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(m.meeting_date)}</div>
            {m.summary && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.summary}</div>}
            <div className="mt-auto flex items-center justify-between pt-3">
              <StatusPill s={m.status} />
              <Actions m={m} onListen={onListen} onTranscript={onTranscript} compact />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ meetings, cursor, setCursor, onOpen }: { meetings: MeetingListItem[]; cursor: Date; setCursor: (d: Date) => void; onOpen: (id: string) => void }) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map<number, MeetingListItem[]>();
  for (const m of meetings) {
    if (!m.meeting_date) continue;
    const d = new Date(m.meeting_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      byDay.set(day, [...(byDay.get(day) || []), m]);
    }
  }
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">{monthLabel}</div>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date())} className="rounded-md border border-border px-2 text-xs hover:bg-muted">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className={cn("min-h-[84px] rounded-lg border p-1", day ? "border-border" : "border-transparent")}>
            {day && <div className="mb-1 text-[11px] text-muted-foreground">{day}</div>}
            <div className="space-y-1">
              {(byDay.get(day || -1) || []).slice(0, 3).map((m) => (
                <button key={m.id} onClick={() => onOpen(m.id)} className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium", typeColor(m.meeting_type))} title={m.title}>{m.title}</button>
              ))}
              {(byDay.get(day || -1) || []).length > 3 && <div className="text-[10px] text-muted-foreground">+{(byDay.get(day || -1) || []).length - 3} more</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
