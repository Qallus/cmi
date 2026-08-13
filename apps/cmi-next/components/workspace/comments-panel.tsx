"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Check, RotateCcw, Trash2, Reply, Send } from "lucide-react";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { Button } from "@/components/workspace/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceComment, MentionUser } from "@/lib/workspace/comments";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommentsPanel({ documentId, comments, mentionable }: { documentId: string; comments: WorkspaceComment[]; mentionable: MentionUser[] }) {
  const router = useRouter();
  const actionToken = useDashboardActionToken();
  const [showResolved, setShowResolved] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { threads, repliesByParent } = useMemo(() => {
    const replies = new Map<string, WorkspaceComment[]>();
    const tops: WorkspaceComment[] = [];
    for (const c of comments) {
      if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
      else tops.push(c);
    }
    return { threads: tops, repliesByParent: replies };
  }, [comments]);

  const visible = showResolved ? threads : threads.filter((t) => !t.resolved_at);

  async function act(url: string, method: "PATCH" | "DELETE", body: Record<string, unknown> = {}) {
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionToken, ...body }) });
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium"><MessageSquare className="h-4 w-4" /> Comments</p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved</label>
      </div>

      <Composer documentId={documentId} parentId={null} mentionable={mentionable} placeholder="Add a comment… use @ to mention" onDone={() => router.refresh()} />

      <div className="space-y-3">
        {!visible.length ? <p className="py-4 text-center text-xs text-muted-foreground">No comments yet.</p> : visible.map((c) => (
          <div key={c.id} className={cn("rounded-md border p-2", c.resolved_at && "opacity-60")}>
            {c.quote ? <p className="mb-1 border-l-2 border-accent/40 pl-2 text-xs italic text-muted-foreground">“{c.quote}”</p> : null}
            <CommentBody comment={c} />
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="inline-flex items-center gap-1 hover:text-foreground"><Reply className="h-3 w-3" /> Reply</button>
              <button type="button" onClick={() => act(`/api/workspace/comments/${c.id}`, "PATCH", { resolved: !c.resolved_at })} className="inline-flex items-center gap-1 hover:text-foreground">{c.resolved_at ? <><RotateCcw className="h-3 w-3" /> Reopen</> : <><Check className="h-3 w-3" /> Resolve</>}</button>
              <button type="button" onClick={() => act(`/api/workspace/comments/${c.id}`, "DELETE")} className="inline-flex items-center gap-1 hover:text-destructive"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>

            {(repliesByParent.get(c.id) ?? []).map((r) => (
              <div key={r.id} className="mt-2 border-l pl-2">
                <CommentBody comment={r} />
                <button type="button" onClick={() => act(`/api/workspace/comments/${r.id}`, "DELETE")} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
            ))}

            {replyTo === c.id ? <div className="mt-2"><Composer documentId={documentId} parentId={c.id} mentionable={mentionable} placeholder="Reply…" onDone={() => { setReplyTo(null); router.refresh(); }} /></div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentBody({ comment }: { comment: WorkspaceComment }) {
  return (
    <div>
      <p className="text-xs"><span className="font-medium">{comment.author_name ?? "Someone"}</span> <span className="text-muted-foreground">· {timeAgo(comment.created_at)}</span></p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.body}</p>
    </div>
  );
}

function Composer({ documentId, parentId, mentionable, placeholder, onDone }: { documentId: string; parentId: string | null; mentionable: MentionUser[]; placeholder: string; onDone: () => void }) {
  const actionToken = useDashboardActionToken();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return mentionable.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, mentionable]);

  function onChange(v: string) {
    setText(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\p{L}\p{N} ]*)$/u);
    setQuery(m ? m[1].trimStart() : null);
  }

  function pick(u: MentionUser) {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}\p{N} ]*)$/u, `@${u.name} `);
    const after = text.slice(caret);
    setText(before + after);
    setMentioned((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setQuery(null);
    setTimeout(() => el?.focus(), 0);
  }

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/workspace/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, body: text, parentId, mentionedUserIds: mentioned }),
      });
      setText(""); setMentioned([]); setQuery(null);
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
      />
      {query !== null && matches.length ? (
        <div className="absolute left-2 z-20 mt-0.5 w-56 rounded-md border bg-popover p-1 shadow-md">
          {matches.map((u) => <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(u); }} className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent">@{u.name}</button>)}
        </div>
      ) : null}
      <div className="mt-1 flex justify-end">
        <Button size="sm" onClick={submit} disabled={sending || !text.trim()}><Send className="mr-1.5 h-3.5 w-3.5" /> {parentId ? "Reply" : "Comment"}</Button>
      </div>
    </div>
  );
}
