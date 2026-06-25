"use client";

import * as React from "react";
import { Mic, Plus, RefreshCw, Search, Eye, FileAudio, Image as ImageIcon, Sparkles, Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MEETING_TYPES, MEETING_TYPE_LABELS, type MeetingListItem, type MeetingStatus } from "@/lib/meetings/types";
import { MeetingDetail, type LinkOption } from "./meeting-detail";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  transcribed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  reviewed: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  action_items_created: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  shared_with_client: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", processing: "Processing", transcribed: "Transcribed", reviewed: "Reviewed",
  action_items_created: "Action items", shared_with_client: "Shared", archived: "Archived",
};

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
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [options, setOptions] = React.useState<{ contacts: LinkOption[]; projects: LinkOption[]; quotes: LinkOption[] }>({ contacts: [], projects: [], quotes: [] });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (typeFilter) qs.set("type", typeFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/meetings?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setMeetings(json.meetings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings.");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    function norm(j: unknown, labeler: (r: Record<string, unknown>) => string): LinkOption[] {
      const arr = Array.isArray(j) ? j : ((j as Record<string, unknown>)?.contacts || (j as Record<string, unknown>)?.items || (j as Record<string, unknown>)?.quotes || []);
      return (arr as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: labeler(r) }));
    }
    (async () => {
      try {
        const [c, p, q] = await Promise.all([
          fetch("/api/contacts").then((r) => r.ok ? r.json() : []),
          fetch("/api/project-manager/schedule?board_id=default").then((r) => r.ok ? r.json() : []),
          fetch("/api/quotes").then((r) => r.ok ? r.json() : []),
        ]);
        setOptions({
          contacts: norm(c, (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || String(r.email ?? "Contact")),
          projects: norm(p, (r) => String(r.title ?? r.project_title ?? "Project")).filter((_, i) => {
            const arr = Array.isArray(p) ? p : (p.items || []);
            return (arr[i]?.type ?? "project") === "project";
          }),
          quotes: norm(q, (r) => String(r.name ?? "Quote")),
        });
      } catch { /* options are optional */ }
    })();
  }, []);

  async function createMeeting() {
    setCreating(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Untitled meeting", meeting_type: "client_meeting", status: "draft", meeting_date: new Date().toISOString() }),
      });
      const json = await res.json();
      if (res.ok && json.meeting) setSelectedId(json.meeting.id);
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(meetingId: string, status: string) {
    await fetch(`/api/meetings/${meetingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }
  async function remove(meetingId: string) {
    if (!window.confirm("Delete this meeting and its recording? This cannot be undone.")) return;
    await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  if (selectedId) {
    return (
      <MeetingDetail
        id={selectedId}
        options={options}
        onBack={() => { setSelectedId(null); load(); }}
        onDeleted={() => { setSelectedId(null); load(); }}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <h1 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Mic className="h-5 w-5 text-accent" /> Recording Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>
          <Button size="sm" variant="accent" onClick={createMeeting} disabled={creating}><Plus className="h-3.5 w-3.5" /> New recording</Button>
        </div>
      </div>

      <div className="p-5">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent">
            <option value="">All types</option>
            {MEETING_TYPES.map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent">
            <option value="">All statuses</option>
            {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {loading && !meetings.length ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <Mic className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No recordings yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">Create a meeting record, then upload or record audio to transcribe and summarize it with Bolt.</p>
            <Button size="sm" variant="accent" className="mt-4" onClick={createMeeting}><Plus className="h-3.5 w-3.5" /> New recording</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-3">Meeting</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {meetings.map((m) => (
                  <tr key={m.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(m.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.title}</div>
                      {m.summary && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{m.summary}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtDate(m.meeting_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {m.recording_path && <FileAudio className="h-4 w-4 text-accent" />}
                        {m.image_url && <ImageIcon className="h-4 w-4 text-blue-500" />}
                        {!m.recording_path && !m.image_url && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[m.status as MeetingStatus] || STATUS_STYLE.draft)}>
                        {STATUS_LABEL[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedId(m.id)} title="Open" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
                        {m.status === "archived" ? (
                          <button onClick={() => setStatus(m.id, "reviewed")} title="Restore" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => setStatus(m.id, "archived")} title="Archive" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Archive className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => remove(m.id)} title="Delete" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" /> Calendar view, client-portal sharing, and auto Zoom/Teams/Meet sync are planned for a later phase.</p>
      </div>
    </div>
  );
}
