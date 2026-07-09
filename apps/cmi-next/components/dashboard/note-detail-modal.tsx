"use client";

import * as React from "react";
import { ExternalLink, ImageOff, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { cn } from "@/lib/utils";
import {
  NOTE_STATUSES, NOTE_STATUS_LABELS, NOTE_TYPE_LABELS,
  type DashboardNote, type DashboardNoteComment, type DashboardNoteStatus,
} from "@/lib/dashboard-notes/types";

const STATUS_TONE: Record<string, string> = {
  open: "bg-info/15 text-info", in_progress: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success", archived: "bg-muted text-muted-foreground",
};
const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive",
};

export function NoteDetailModal({ noteId, onClose, onChanged }: { noteId: string; onClose: () => void; onChanged?: () => void }) {
  const [note, setNote] = React.useState<DashboardNote | null>(null);
  const [comments, setComments] = React.useState<DashboardNoteComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [lightbox, setLightbox] = React.useState(false);

  // Close the screenshot lightbox on Escape (without closing the whole modal).
  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setLightbox(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightbox]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_note", id: noteId }) });
        const json = await res.json() as { note?: DashboardNote; comments?: DashboardNoteComment[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load.");
        if (alive) { setNote(json.note ?? null); setComments(json.comments ?? []); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Failed to load."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [noteId]);

  async function changeStatus(status: DashboardNoteStatus) {
    if (!note) return;
    setNote({ ...note, status });
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_status", id: note.id, status }) }).catch(() => {});
    onChanged?.();
  }

  async function doDelete() {
    if (!note) return;
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: note.id }) }).catch(() => {});
    onChanged?.(); onClose();
  }
  async function doArchive() {
    if (!note) return;
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_status", id: note.id, status: "archived" }) }).catch(() => {});
    onChanged?.(); onClose();
  }

  async function sendReply() {
    if (!note || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_comment", id: note.id, comment: reply.trim() }) });
      const json = await res.json() as { comment?: DashboardNoteComment; error?: string };
      if (!res.ok || !json.comment) throw new Error(json.error ?? "Failed.");
      setComments((prev) => [...prev, json.comment!]);
      setReply("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to reply."); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Dashboard request</div>
            <h2 className="truncate text-base font-semibold">{note?.page_title ?? "Request"}</h2>
          </div>
          <div className="flex items-center gap-1">
            {note && <button type="button" className="rounded p-1 text-muted-foreground hover:text-destructive" onClick={() => setShowConfirm(true)} title="Delete request"><Trash2 className="h-4 w-4" /></button>}
            <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : !note ? (
          <div className="px-5 py-16 text-center text-sm text-destructive">{error ?? "Not found."}</div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1.4fr_1fr]">
            {/* Left: screenshot + note */}
            <div className="min-h-0 overflow-y-auto border-b border-border p-4 md:border-b-0 md:border-r">
              <div className="mb-3 overflow-hidden rounded-lg border border-border bg-muted/30">
                {note.screenshot_url ? (
                  <button type="button" onClick={() => setLightbox(true)} title="Click to enlarge" className="block w-full cursor-zoom-in">
                    <img src={note.screenshot_url} alt="Screenshot" className="w-full object-contain" />
                  </button>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-6 w-6 opacity-50" /><span className="text-xs">No screenshot attached</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", PRIORITY_TONE[note.priority])}>{note.priority}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{NOTE_TYPE_LABELS[note.type]}</span>
                {note.route && <a href={note.route} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-accent">Open page <ExternalLink className="h-3 w-3" /></a>}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.note}</p>
              <div className="mt-3 text-[11px] text-muted-foreground">By {note.created_by_name ?? note.created_by} · {new Date(note.created_at).toLocaleString()}</div>
            </div>

            {/* Right: status + thread */}
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-border p-4">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                <select value={note.status} onChange={(e) => void changeStatus(e.target.value as DashboardNoteStatus)}
                  className={cn("h-9 w-full rounded-md border border-border bg-background px-2 text-sm font-medium outline-none", STATUS_TONE[note.status])}>
                  {NOTE_STATUSES.map((s) => <option key={s} value={s}>{NOTE_STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Replies</div>
                {comments.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No replies yet. Add a note back below.</div>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border bg-background p-2.5">
                        <div className="mb-0.5 flex items-center justify-between"><span className="text-[11px] font-semibold">{c.author_name ?? c.author_email}</span><span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
                        <div className="whitespace-pre-wrap text-xs">{c.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border p-3">
                {error && <div className="mb-2 text-[11px] text-destructive">{error}</div>}
                <div className="flex items-end gap-2">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Note back…"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                    className="min-h-[40px] flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent" />
                  <Button size="sm" variant="accent" className="h-10 px-3" disabled={sending || !reply.trim()} onClick={() => void sendReply()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmDeleteDialog
          onConfirm={async () => { setShowConfirm(false); await doDelete(); }}
          onArchive={async () => { setShowConfirm(false); await doArchive(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Screenshot lightbox — stays in-app (with a close X) instead of opening
          the raw image in a new tab, so the user returns to this modal. */}
      {lightbox && note?.screenshot_url && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(false)}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox(false); }} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" title="Close (Esc)" aria-label="Close screenshot">
            <X className="h-5 w-5" />
          </button>
          <img src={note.screenshot_url} alt="Screenshot" className="max-h-[92vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
          <a href={note.screenshot_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20">
            Open original <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
