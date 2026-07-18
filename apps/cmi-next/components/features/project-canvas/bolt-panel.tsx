"use client";

import * as React from "react";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "./canvas-api";
import type { BoltReadback, BoltSuggestion } from "./canvas-api";
import type { CanvasStore } from "./use-canvas-store";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function BoltPanel({ store, className }: { store: CanvasStore; className?: string }) {
  const canvasId = store.canvas?.id ?? "";
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [readback, setReadback] = React.useState<BoltReadback | null>(null);
  const [suggestions, setSuggestions] = React.useState<BoltSuggestion[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, readback, suggestions, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await api.apiBolt({ canvasId, mode: "chat", message: trimmed, history });
      setMessages((m) => [...m, { role: "assistant", content: res.reply || "(no response)" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bolt request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function suggestPins() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiBolt({ canvasId, mode: "suggest_pins" });
      setSuggestions(res.suggestions ?? []);
      if (!res.suggestions?.length) setMessages((m) => [...m, { role: "assistant", content: "Your canvas already covers the essentials — add photos or notes and I'll suggest more." }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bolt request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function readBack() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiBolt({ canvasId, mode: "read_back" });
      if (res.readback) setReadback(res.readback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bolt request failed.");
    } finally {
      setLoading(false);
    }
  }

  function acceptSuggestion(s: BoltSuggestion, idx: number) {
    if (store.readOnly || !store.activeScene) return;
    const pins = store.activeScene.annotations.pins;
    const nextNum = Math.max(0, ...pins.filter((p) => p.kind === "note").map((p) => p.number ?? 0)) + 1;
    // Spread accepted pins around the center so they don't stack.
    const angle = (idx / 5) * Math.PI * 2;
    const x = 0.5 + Math.cos(angle) * 0.18;
    const y = 0.5 + Math.sin(angle) * 0.18;
    const id = (() => { try { return crypto.randomUUID(); } catch { return `id-${Date.now()}-${idx}`; } })();
    store.mutateActiveAnnotations((a) => ({ ...a, pins: [...a.pins, { id, kind: "note", x, y, number: nextNum, text: s.note }] }));
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-amber-400 text-white"><Sparkles className="h-4 w-4" /></span>
        <div>
          <div className="text-sm font-semibold">Bolt · Design Assistant</div>
          <div className="text-[11px] text-muted-foreground">Watching your canvas · {store.scenes.length} scene{store.scenes.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !readback && suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask about your project, or tap <b>Suggest pins</b> and <b>Read it back</b> below. Bolt drafts ideas — nothing is sent to the team until you submit.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed", m.role === "user" ? "ml-auto bg-accent/15 text-foreground" : "border border-border bg-muted/40")}>
            {m.content}
          </div>
        ))}

        {suggestions.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#c87f3a]">Suggested pins — tap to add</div>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button key={i} type="button" onClick={() => acceptSuggestion(s, i)} disabled={store.readOnly || !store.activeScene}
                  className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs transition hover:border-accent/50 disabled:opacity-50">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2e7d5b]" />
                  <span><b>{s.label}:</b> {s.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {readback && (
          <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#966e1d] dark:text-[#c99a3a]"><Sparkles className="h-3 w-3" /> Bolt&apos;s Project Read-Back</div>
            <h4 className="font-display text-base">{readback.headline}</h4>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{readback.narrative}</p>
            {readback.chips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {readback.chips.map((c, i) => <span key={i} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{c}</span>)}
              </div>
            )}
          </div>
        )}

        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Bolt is thinking…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="mb-2 flex gap-1.5">
          <button type="button" onClick={suggestPins} disabled={loading} className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:opacity-50">Suggest pins</button>
          <button type="button" onClick={readBack} disabled={loading} className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:opacity-50">Read it back</button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            placeholder="Ask Bolt about your project…"
            className="max-h-24 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="button" onClick={() => void send(input)} disabled={loading || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
