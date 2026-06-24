"use client";

import * as React from "react";
import {
  Bot, Check, CheckCircle2, ClipboardCopy, Loader2, Send, Sparkles,
  Trash2, Wrench, X, AlertTriangle, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PendingAction, ToolActivity } from "@/lib/agent/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  activities?: ToolActivity[];
  pending?: PendingAction[];
};

type ActionStatus = { state: "idle" | "running" | "done" | "error"; note?: string };

const STARTERS = [
  "Show me new quotes and their estimated values",
  "Create a contact for Jane Doe, jane@acme.com, company Acme Builders",
  "What fields does a contract document have?",
  "List this week's bookings",
  "Draft an email to a lead introducing our services",
  "Find the contact named Mitchell and show their details",
];

function formatTranscript(messages: Message[]) {
  return messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}`).join("\n\n---\n\n");
}

export function AgentClient({ configured }: { configured: boolean }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<Record<string, ActionStatus>>({});
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  function reset() { setMessages([]); setError(null); setInput(""); setActionStatus({}); }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const json = await res.json() as {
        message?: { content?: string };
        activities?: ToolActivity[];
        pendingActions?: PendingAction[];
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: json.message?.content || "(no response)",
        activities: json.activities ?? [],
        pending: json.pendingActions ?? [],
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction(action: PendingAction) {
    setActionStatus((s) => ({ ...s, [action.id]: { state: "running" } }));
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({})) as { result?: { message?: string }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Action failed.");
      setActionStatus((s) => ({ ...s, [action.id]: { state: "done", note: json.result?.message || "Done." } }));
    } catch (err) {
      setActionStatus((s) => ({ ...s, [action.id]: { state: "error", note: err instanceof Error ? err.message : "Failed." } }));
    }
  }

  function dismissAction(id: string) {
    setActionStatus((s) => ({ ...s, [id]: { state: "done", note: "Dismissed." } }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(formatTranscript(messages));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">AI Agent</div>
          <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></span>
            Bolt
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your dashboard copilot — Bolt can look up, create, update, and (with your OK) delete or message across the dashboard.</p>
        </div>
        {messages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy transcript"}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>Clear</Button>
          </div>
        )}
      </header>

      {!configured && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <strong>Bolt&apos;s brain isn&apos;t connected.</strong> Add{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">HERMES_AGENT_URL</code> (and key) to the environment. The gateway must support OpenAI tool-calling for Bolt to take actions.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-3">
        <div className="overflow-y-auto rounded-lg border border-border bg-card">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10"><Sparkles className="h-6 w-6 text-accent" /></div>
              <div>
                <div className="font-semibold">Hi, I&apos;m Bolt.</div>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">Ask me to find, create, or update anything in the dashboard — contacts, quotes, projects, tasks, documents, blog posts, emails, and more.</p>
              </div>
              <div className="grid w-full max-w-2xl gap-2 md:grid-cols-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-accent hover:bg-accent/5 hover:text-foreground">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3 px-4 py-4", msg.role === "assistant" && "bg-muted/30")}>
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", msg.role === "user" ? "bg-accent text-accent-foreground" : "border border-border bg-card text-accent")}>
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{msg.role === "user" ? "You" : "Bolt"}</div>

                    {/* Tool activity */}
                    {msg.activities && msg.activities.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {msg.activities.map((a, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", a.ok ? "border-border bg-muted/60 text-muted-foreground" : "border-destructive/40 bg-destructive/10 text-destructive")}>
                            <Wrench className="h-2.5 w-2.5" />{a.summary}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.content && <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>}

                    {/* Pending confirmation cards */}
                    {msg.pending && msg.pending.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.pending.map((action) => {
                          const st = actionStatus[action.id] ?? { state: "idle" as const };
                          return (
                            <div key={action.id} className={cn("rounded-lg border p-3", action.kind === "delete" ? "border-destructive/40 bg-destructive/5" : "border-accent/40 bg-accent/5")}>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {action.kind === "delete" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Send className="h-4 w-4 text-accent" />}
                                {action.summary}
                              </div>
                              {action.kind === "send" && action.body && (
                                <div className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                                  {action.subject && <div className="font-medium text-foreground">{action.subject}</div>}
                                  <div className="whitespace-pre-wrap">{action.body}</div>
                                </div>
                              )}
                              {st.state === "done" ? (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-success"><Check className="h-3.5 w-3.5" />{st.note}</div>
                              ) : st.state === "error" ? (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><X className="h-3.5 w-3.5" />{st.note}</div>
                              ) : (
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" variant={action.kind === "delete" ? "destructive" : "accent"} disabled={st.state === "running"} onClick={() => confirmAction(action)}>
                                    {st.state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.kind === "delete" ? <Trash2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                                    {action.kind === "delete" ? "Confirm delete" : "Confirm & send"}
                                  </Button>
                                  <Button size="sm" variant="outline" disabled={st.state === "running"} onClick={() => dismissAction(action.id)}>Dismiss</Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 bg-muted/30 px-4 py-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-accent"><Bot className="h-3.5 w-3.5" /></div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Working…</div>
                </div>
              )}
              {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            className="flex-1 resize-none"
            rows={3}
            placeholder="Ask Bolt to find or change something… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button variant="accent" className="h-auto self-stretch px-4" disabled={loading || !input.trim()} onClick={() => void send(input)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
