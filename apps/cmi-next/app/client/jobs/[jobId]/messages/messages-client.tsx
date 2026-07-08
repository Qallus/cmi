"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { id: string; sender_type: string; sender_name: string | null; body: string; created_at: string };

function time(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function ClientMessages({ jobId, initial }: { jobId: string; initial: Msg[] }) {
  const [msgs, setMsgs] = React.useState<Msg[]>(initial);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setMsgs((m) => [...m, j]); setBody("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send."); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-3">
        {msgs.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No messages yet. Start the conversation with your team below.</div>}
        {msgs.map((m) => {
          const mine = m.sender_type === "client";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "bg-accent text-accent-foreground" : "border border-border bg-card"}`}>
                {!mine && <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">{m.sender_name ?? "CMI Team"}</div>}
                <div className="whitespace-pre-wrap text-sm">{m.body}</div>
                <div className={`mt-1 text-[10px] ${mine ? "text-accent-foreground/70" : "text-muted-foreground"}`}>{time(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="sticky bottom-4 mt-4 flex items-end gap-2 rounded-xl border border-border bg-card p-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message your project team…" rows={2}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" />
        <Button type="submit" variant="accent" size="sm" disabled={busy || !body.trim()}><Send className="h-3.5 w-3.5" /> Send</Button>
      </form>
      {error && <div className="mt-2 text-center text-sm text-destructive">{error}</div>}
    </div>
  );
}
