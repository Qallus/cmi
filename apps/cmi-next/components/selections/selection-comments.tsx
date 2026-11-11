"use client";

// The client ↔ team thread on a selection. Used in the comments slide-out
// (from any job Selections view), the card preview and the editor.
import * as React from "react";
import { Check, CheckCircle2, Loader2, MessageSquare, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { ACTION_LABEL, isOpen, relTime, summarize, type CommentSummary, type SelectionComment } from "@/lib/selection-comments/thread";

const ACTION_TONE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
  revision_requested: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export function SelectionCommentsThread({ jobId, selectionId, canReply = true, onChanged, compact }: {
  jobId: string; selectionId: string; canReply?: boolean;
  /** The thread's new summary after a load, reply or handled change (for badges). */
  onChanged?: (s: CommentSummary) => void;
  compact?: boolean;
}) {
  const [comments, setComments] = React.useState<SelectionComment[] | null>(null);
  const [migrated, setMigrated] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const base = `/api/jobs/${jobId}/selections/${selectionId}/comments`;
  const changed = React.useRef(onChanged);
  React.useEffect(() => { changed.current = onChanged; }, [onChanged]);

  const apply = React.useCallback((list: SelectionComment[]) => { setComments(list); changed.current?.(summarize(list)); }, []);

  React.useEffect(() => {
    let live = true;
    fetch(base).then(async (r) => {
      const j = await r.json();
      if (!live) return;
      if (!r.ok) { setError(j.error || "Could not load comments."); setComments([]); return; }
      setMigrated(j.migrated !== false);
      apply(j.comments ?? []);
    }).catch(() => { if (live) { setError("Could not load comments."); setComments([]); } });
    return () => { live = false; };
  }, [base, apply]);

  async function send() {
    if (!reply.trim() || !comments) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Reply failed.");
      const now = j.created_at as string;
      apply([...comments.map((c) => (isOpen(c) ? { ...c, handled_at: now } : c)), j]);
      setReply("");
    } catch (e) { setError(e instanceof Error ? e.message : "Reply failed."); } finally { setBusy(false); }
  }

  async function toggle(c: SelectionComment) {
    if (!comments) return;
    setError(null);
    const r = await fetch(`${base}/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handled: !c.handled_at }) });
    const j = await r.json();
    if (!r.ok) { setError(j.error || "Could not update."); return; }
    apply(comments.map((x) => (x.id === c.id ? j : x)));
  }

  if (comments === null) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading comments…</div>;

  return (
    <div className="space-y-3">
      {!migrated && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">Showing the client&apos;s notes. Replies and Handled turn on once the selection comments update is applied.</p>}
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No comments yet. When the client approves, declines or comments in their portal it shows here.</p>
      ) : (
        <ol className={compact ? "space-y-2" : "space-y-3"}>
          {comments.map((c) => {
            const client = c.author_kind === "client";
            const open = isOpen(c);
            return (
              <li key={c.id} className={`flex ${client ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[92%] rounded-xl border px-3 py-2 text-sm ${client ? (open ? "border-accent/50 bg-accent/5" : "border-border bg-muted/40") : "border-border bg-card"}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.author_name || (client ? "Client" : "CMI")}</span>
                    {c.author_name && c.author_name !== "Client" && <span>{client ? "Client" : "Team"}</span>}
                    {c.action !== "comment" && c.action !== "reply" && c.action !== "legacy" && (
                      <span className={`rounded-full px-1.5 py-0.5 font-medium ${ACTION_TONE[c.action] ?? "bg-muted"}`}>{ACTION_LABEL[c.action] ?? c.action}</span>
                    )}
                    <span title={new Date(c.created_at).toLocaleString()}>{relTime(c.created_at)}</span>
                    {open && <span className="rounded-full bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">New</span>}
                  </div>
                  {c.body ? <p className="whitespace-pre-line break-words">{linkify(c.body)}</p> : <p className="italic text-muted-foreground">No note</p>}
                  {client && migrated && !c.id.startsWith("legacy-") && (
                    <button type="button" onClick={() => void toggle(c)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-accent">
                      {c.handled_at ? <><RotateCcw className="h-3 w-3" /> Handled · reopen</> : <><Check className="h-3 w-3" /> Mark handled</>}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {error && <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {canReply && migrated && (
        <div className="space-y-2 border-t border-border pt-3">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={compact ? 2 : 3} maxLength={4000}
            placeholder="Reply to the client. They'll see it under this selection in their portal."
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Replying marks their comments handled.</span>
            <Button size="sm" variant="accent" disabled={!reply.trim() || busy} onClick={() => void send()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The thread in a right-hand slide-out (full width on phones). */
export function SelectionCommentsPanel({ jobId, selection, onClose, onChanged }: {
  jobId: string; selection: { id: string; name: string }; onClose: () => void; onChanged?: (s: CommentSummary) => void;
}) {
  return (
    <SidePanel title="Comments" subtitle={selection.name} onClose={onClose}>
      <SelectionCommentsThread jobId={jobId} selectionId={selection.id} onChanged={onChanged} />
    </SidePanel>
  );
}

/** A small 💬 button with the count; accent when something is waiting on the team. */
export function CommentsButton({ summary, onClick, label }: { summary?: CommentSummary | null; onClick: () => void; label?: boolean }) {
  const n = summary?.count ?? 0;
  const open = summary?.open ?? 0;
  return (
    <button type="button" onClick={onClick} title={open ? `${open} new client comment${open === 1 ? "" : "s"}` : n ? `${n} comment${n === 1 ? "" : "s"}` : "Comments"}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 text-xs transition ${open ? "bg-accent/15 font-semibold text-accent" : n ? "text-foreground hover:text-accent" : "text-muted-foreground hover:text-foreground"}`}>
      {open ? <MessageSquare className="h-3.5 w-3.5 fill-current" /> : <MessageSquare className="h-3.5 w-3.5" />}
      {n > 0 && <span>{open ? `${open} new` : n}</span>}
      {label && !n && <span>Comments</span>}
    </button>
  );
}

/** The latest comment on a card: who, when and the first lines. */
export function LatestComment({ summary, onClick }: { summary?: CommentSummary | null; onClick: () => void }) {
  const l = summary?.latest;
  if (!l) return null;
  const open = (summary?.open ?? 0) > 0;
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:border-accent ${open ? "border-accent/50 bg-accent/5" : "border-border bg-muted/30"}`}>
      <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {open ? <MessageSquare className="h-3 w-3 fill-current text-accent" /> : <CheckCircle2 className="h-3 w-3" />}
        <span className="truncate font-semibold text-foreground">{l.author_name || (l.author_kind === "client" ? "Client" : "Team")}</span>
        {l.action !== "comment" && l.action !== "reply" && l.action !== "legacy" && <span>· {ACTION_LABEL[l.action] ?? l.action}</span>}
        {/* "5d ago" is worked out on the server and again in the browser. */}
        <span className="ml-auto shrink-0" suppressHydrationWarning>{l.created_at ? relTime(l.created_at) : ""}</span>
      </div>
      <p className="line-clamp-2 break-words text-foreground/80">{l.body || "No note"}</p>
      {open && <div className="mt-1 text-[11px] font-semibold text-accent">{summary!.open} new · open to reply</div>}
    </button>
  );
}

function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-accent underline">{p.length > 60 ? `${p.slice(0, 57)}…` : p}</a>
    : <React.Fragment key={i}>{p}</React.Fragment>);
}
