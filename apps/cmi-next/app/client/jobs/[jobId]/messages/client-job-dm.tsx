"use client";

import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { id: string; sender_id: string | null; body: string; created_at: string; mine: boolean };

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// The client's direct-message thread with their project team (PM), scoped to the
// job. Uses the unified DM system, so staff see it in the job's Messages tab too.
export function ClientJobDm({ jobId }: { jobId: string }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [other, setOther] = React.useState<{ name: string } | null>(null);
  const [reply, setReply] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/dm`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load messages."); return; }
      setMessages(data.messages ?? []);
      setOther(data.conversation?.other ?? null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => { void load(); const i = setInterval(() => void load(), 15000); return () => clearInterval(i); }, [load]);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/dm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (res.ok) { setReply(""); await load(); }
      else { const d = await res.json(); setError(d.error ?? "Could not send."); }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold">{other ? `Messaging ${other.name}` : "Message your project team"}</div>
        <div className="text-xs text-muted-foreground">Questions about your project? Send a message and your team will reply here.</div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{error}</div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No messages yet. Say hello to your project team.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-muted")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("mt-1 text-[11px]", m.mine ? "text-accent-foreground/70" : "text-muted-foreground")}>{fmt(m.created_at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Message your team…"
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          />
          <Button onClick={() => void send()} disabled={sending || !reply.trim()} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
