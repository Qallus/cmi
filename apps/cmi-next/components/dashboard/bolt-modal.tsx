"use client";

import * as React from "react";
import { Bot, Loader2, Mic, MicOff, Send, Sparkles, User, Wrench, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingAction, ToolActivity } from "@/lib/agent/types";

type Msg = { id: string; role: "user" | "assistant"; content: string; activities?: ToolActivity[]; pending?: PendingAction[] };

// Minimal typing for the browser SpeechRecognition API (no DOM lib types for it).
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function BoltModal({ context, onClose }: { context?: string; onClose: () => void }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<SpeechRec | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const firstSent = React.useRef(false);
  const speechSupported = React.useMemo(() => getSpeechCtor() !== null, []);

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  React.useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  function toggleMic() {
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } setListening(false); return; }
    const Ctor = getSpeechCtor();
    if (!Ctor) { setError("Voice input isn't supported in this browser."); return; }
    const rec = new Ctor();
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } setListening(false); }
    setInput(""); setError(null);
    // Ground Bolt with the current page on the first turn.
    const outbound = !firstSent.current && context ? `[Context: I'm on the ${context} dashboard page.] ${trimmed}` : trimmed;
    firstSent.current = true;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: outbound }] }),
      });
      const json = await res.json() as { message?: { content?: string }; activities?: ToolActivity[]; pendingActions?: PendingAction[]; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: json.message?.content || "(no response)", activities: json.activities ?? [], pending: json.pendingActions ?? [] }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Request failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></span>
            <div><div className="text-sm font-semibold">Bolt</div>{context && <div className="text-[11px] text-muted-foreground">On: {context}</div>}</div>
          </div>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-accent/10"><Sparkles className="h-5 w-5 text-accent" /></div>
              <p className="max-w-xs text-sm text-muted-foreground">Ask Bolt about this page or the dashboard. Any changes Bolt proposes are saved as drafts — nothing publishes automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-3 px-4 py-3", m.role === "assistant" && "bg-muted/30")}>
                  <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", m.role === "user" ? "bg-accent text-accent-foreground" : "border border-border bg-card text-accent")}>
                    {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {m.activities && m.activities.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {m.activities.map((a, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", a.ok ? "border-border bg-muted/60 text-muted-foreground" : "border-destructive/40 bg-destructive/10 text-destructive")}><Wrench className="h-2.5 w-2.5" />{a.summary}</span>
                        ))}
                      </div>
                    )}
                    {m.content && <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>}
                    {m.pending && m.pending.length > 0 && (
                      <div className="mt-2 rounded-md border border-accent/40 bg-accent/5 px-2.5 py-2 text-[11px] text-muted-foreground">
                        Bolt staged an action that needs confirmation. Open the <Link href="/dashboard/agent" className="font-medium text-accent">full Agent page</Link> to review and confirm it.
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Working…</div>}
              {error && <div className="px-4 py-2 text-sm text-destructive">{error}</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          {speechSupported && (
            <button type="button" onClick={toggleMic} title={listening ? "Stop dictation" : "Dictate"}
              className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md border", listening ? "border-accent bg-accent/10 text-accent animate-pulse" : "border-border text-muted-foreground hover:text-foreground")}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <textarea
            className="min-h-[40px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            rows={1}
            placeholder="Ask Bolt… (Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            disabled={loading}
          />
          <Button variant="accent" className="h-10 px-3" disabled={loading || !input.trim()} onClick={() => void send(input)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
