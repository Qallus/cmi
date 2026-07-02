"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Bell, LayoutGrid, List, Loader2, RefreshCw, Table as TableIcon, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/dashboard/confirm-delete-dialog";
import { cn } from "@/lib/utils";
import {
  SESSION_STATUSES, SESSION_STATUS_LABELS,
  type Priority, type ReviewSession, type SessionStatus, type SessionSummary,
} from "@/lib/live-editor/types";

type View = "cards" | "list" | "table";

const STATUS_TONE: Record<string, string> = {
  open: "bg-info/15 text-info",
  in_progress: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};
const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}
function statusLabel(s: string) { return SESSION_STATUS_LABELS[(s as SessionStatus)] ?? s; }

export function ReviewsClient() {
  const [rows, setRows] = React.useState<SessionSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>("cards");
  const [notify, setNotify] = React.useState<SessionSummary | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<SessionSummary | null>(null);
  const visibleRows = React.useMemo(() => rows.filter((r) => r.session.status !== "archived"), [rows]);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/site-content/live-editor?list=sessions");
      const json = await res.json() as { sessions?: SessionSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRows(json.sessions ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load reviews."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function changeStatus(row: SessionSummary, status: SessionStatus) {
    setRows((prev) => prev.map((r) => (r.session.id === row.session.id ? { ...r, session: { ...r.session, status } } : r)));
    try {
      await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_session", id: row.session.id, patch: { status } }),
      });
    } catch { void load(); }
  }

  function applyNotifiedSession(updated: ReviewSession) {
    setRows((prev) => prev.map((r) => (r.session.id === updated.id ? { ...r, session: updated } : r)));
  }

  async function hardRemove(row: SessionSummary) {
    setRows((prev) => prev.filter((r) => r.session.id !== row.session.id));
    await fetch("/api/site-content/live-editor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_session", id: row.session.id }),
    }).catch(() => void load());
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live Page Editor</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Saved Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every page review / edit request. Open one to reopen the page with its notes, or notify the requester of progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/site-content/live-editor" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Editor
          </Link>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {([["cards", LayoutGrid], ["list", List], ["table", TableIcon]] as const).map(([v, Icon]) => (
              <button key={v} type="button" title={v} onClick={() => setView(v)}
                className={cn("inline-flex h-7 w-7 items-center justify-center rounded", view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="text-sm text-muted-foreground">No page reviews yet.</div>
          <Link href="/dashboard/site-content/live-editor" className="text-sm font-medium text-accent">Start a review →</Link>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((r) => <ReviewCard key={r.session.id} row={r} onStatus={changeStatus} onNotify={() => setNotify(r)} onDelete={setConfirmDel} />)}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {visibleRows.map((r) => <ReviewRow key={r.session.id} row={r} onStatus={changeStatus} onNotify={() => setNotify(r)} onDelete={setConfirmDel} />)}
        </div>
      ) : (
        <ReviewTable rows={visibleRows} onStatus={changeStatus} onNotify={setNotify} onDelete={setConfirmDel} />
      )}

      {notify && (
        <NotifyModal
          row={notify}
          onClose={() => setNotify(null)}
          onDone={(updated) => { if (updated) applyNotifiedSession(updated); setNotify(null); void load(); }}
        />
      )}

      {confirmDel && (
        <ConfirmDeleteDialog
          itemName={`the "${confirmDel.session.page_title ?? confirmDel.session.page_slug}" review`}
          onConfirm={async () => { const r = confirmDel; setConfirmDel(null); await hardRemove(r); }}
          onArchive={async () => { const r = confirmDel; setConfirmDel(null); await changeStatus(r, "archived"); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

function Counts({ row }: { row: SessionSummary }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span>{row.note_count} note{row.note_count !== 1 ? "s" : ""}</span>
      {row.open_count > 0 && <span>· {row.open_count} open</span>}
      {row.resolved_count > 0 && <span>· {row.resolved_count} done</span>}
      {row.top_priority && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[row.top_priority])}>{row.top_priority}</span>}
    </div>
  );
}

function StatusSelect({ row, onStatus }: { row: SessionSummary; onStatus: (r: SessionSummary, s: SessionStatus) => void }) {
  return (
    <select value={row.session.status} onChange={(e) => onStatus(row, e.target.value as SessionStatus)}
      className={cn("h-7 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium outline-none", STATUS_TONE[row.session.status])}>
      {SESSION_STATUSES.map((s) => <option key={s} value={s}>{SESSION_STATUS_LABELS[s]}</option>)}
    </select>
  );
}

function OpenLink({ slug }: { slug: string }) {
  return <Link href={`/dashboard/site-content/live-editor?page=${encodeURIComponent(slug)}`} className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-[11px] font-medium text-accent-foreground hover:opacity-90">Open</Link>;
}

function NotifyBtn({ onNotify, hasTarget }: { onNotify: () => void; hasTarget: boolean }) {
  return <button type="button" onClick={onNotify} title={hasTarget ? "Notify requester" : "No requester email set"} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"><Bell className="h-3 w-3" /> Notify</button>;
}

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
  return <button type="button" onClick={onDelete} title="Delete review" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>;
}

function ReviewCard({ row, onStatus, onNotify, onDelete }: { row: SessionSummary; onStatus: (r: SessionSummary, s: SessionStatus) => void; onNotify: () => void; onDelete: (r: SessionSummary) => void }) {
  const target = row.session.requester_email || row.session.created_by;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{row.session.page_title ?? row.session.page_slug}</div>
          <div className="truncate text-[11px] text-muted-foreground">{row.session.page_url}</div>
        </div>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", STATUS_TONE[row.session.status])}>{statusLabel(row.session.status)}</span>
      </div>
      <Counts row={row} />
      <div className="text-[11px] text-muted-foreground">Requester: {target || "—"} · Updated {fmt(row.last_activity)}</div>
      <div className="mt-1 flex items-center gap-2">
        <OpenLink slug={row.session.page_slug} />
        <StatusSelect row={row} onStatus={onStatus} />
        <NotifyBtn onNotify={onNotify} hasTarget={Boolean(target)} />
        <div className="ml-auto"><DeleteBtn onDelete={() => onDelete(row)} /></div>
      </div>
    </div>
  );
}

function ReviewRow({ row, onStatus, onNotify, onDelete }: { row: SessionSummary; onStatus: (r: SessionSummary, s: SessionStatus) => void; onNotify: () => void; onDelete: (r: SessionSummary) => void }) {
  const target = row.session.requester_email || row.session.created_by;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-medium">{row.session.page_title ?? row.session.page_slug}</div>
        <div className="truncate text-[11px] text-muted-foreground">{target || "no requester"} · {fmt(row.last_activity)}</div>
      </div>
      <Counts row={row} />
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", STATUS_TONE[row.session.status])}>{statusLabel(row.session.status)}</span>
      <div className="flex items-center gap-2">
        <OpenLink slug={row.session.page_slug} />
        <StatusSelect row={row} onStatus={onStatus} />
        <NotifyBtn onNotify={onNotify} hasTarget={Boolean(target)} />
        <DeleteBtn onDelete={() => onDelete(row)} />
      </div>
    </div>
  );
}

function ReviewTable({ rows, onStatus, onNotify, onDelete }: { rows: SessionSummary[]; onStatus: (r: SessionSummary, s: SessionStatus) => void; onNotify: (r: SessionSummary) => void; onDelete: (r: SessionSummary) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {["Page", "Requester", "Notes", "Status", "Updated", ""].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const target = r.session.requester_email || r.session.created_by;
            return (
              <tr key={r.session.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5"><div className="font-medium">{r.session.page_title ?? r.session.page_slug}</div><div className="truncate text-[11px] text-muted-foreground">{r.session.page_url}</div></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{target || "—"}</td>
                <td className="px-4 py-2.5"><Counts row={r} /></td>
                <td className="px-4 py-2.5"><StatusSelect row={r} onStatus={onStatus} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmt(r.last_activity)}</td>
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><OpenLink slug={r.session.page_slug} /><NotifyBtn onNotify={() => onNotify(r)} hasTarget={Boolean(target)} /><DeleteBtn onDelete={() => onDelete(r)} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NotifyModal({ row, onClose, onDone }: { row: SessionSummary; onClose: () => void; onDone: (updated?: ReviewSession) => void }) {
  const [email, setEmail] = React.useState(row.session.requester_email || row.session.created_by || "");
  const [name, setName] = React.useState(row.session.requester_name || "");
  const [status, setStatus] = React.useState<SessionStatus>(row.session.status as SessionStatus);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function send() {
    if (!email.trim()) { setErr("Enter an email address."); return; }
    setBusy(true); setErr(null);
    try {
      // Persist requester details (and status) so future notifications default correctly.
      const patchRes = await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_session", id: row.session.id, patch: { requester_email: email.trim(), requester_name: name.trim() || null, status } }),
      });
      const patchJson = await patchRes.json() as { session?: ReviewSession };

      const res = await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notify_requester", session_id: row.session.id, to_email: email.trim(), status, message: message.trim() || undefined }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Notification failed.");
      setDone(true);
      setTimeout(() => onDone(patchJson.session), 900);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div><h2 className="font-semibold">Notify requester</h2><p className="text-[11px] text-muted-foreground">{row.session.page_title ?? row.session.page_slug}</p></div>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          {err && <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{err}</div>}
          <L label="Send to (email)"><input className={ic} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="requester@example.com" /></L>
          <L label="Requester name (optional)"><input className={ic} value={name} onChange={(e) => setName(e.target.value)} /></L>
          <L label="Update status to"><select className={ic} value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)}>{SESSION_STATUSES.map((s) => <option key={s} value={s}>{SESSION_STATUS_LABELS[s]}</option>)}</select></L>
          <L label="Message (optional)"><textarea className={cn(ic, "min-h-[70px] resize-none py-2")} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a short note for the requester…" /></L>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button size="sm" variant="accent" onClick={() => void send()} disabled={busy || done}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} {done ? "Sent" : "Send update"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Emails the requester the page, its notes, and the new status. Does not publish or change the site.</p>
        </div>
      </div>
    </div>
  );
}

const ic = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[11px] font-medium text-muted-foreground">{label}</label>{children}</div>;
}
