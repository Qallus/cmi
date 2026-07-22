"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Search, PenSquare, Camera, Paperclip, Mic, X, CircleDot, Loader2, FileText, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; email: string };
type Attachment = { type: "image" | "audio" | "video" | "file"; url: string; name: string; mimeType: string; size: number };
type Conversation = {
  id: string;
  other: Person | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  unread: number;
};
type Importance = "normal" | "important" | "urgent";
type Message = { id: string; sender_id: string | null; body: string; importance: Importance; attachments: Attachment[]; created_at: string; mine: boolean };

const IMPORTANCE_DOT: Record<string, string> = {
  normal: "bg-muted-foreground/40",
  important: "bg-accent",
  urgent: "bg-destructive",
};

const DATE_FILTERS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
}
function fromForFilter(value: string): string | undefined {
  if (value === "all") return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (value === "7d") d.setDate(d.getDate() - 7);
  if (value === "30d") d.setDate(d.getDate() - 30);
  return d.toISOString();
}
function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DmInbox({ canStart = true, className, jobId }: { canStart?: boolean; className?: string; jobId?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [reply, setReply] = useState("");
  const [importance, setImportance] = useState<Importance>("normal");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/direct-messages/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.attachment) setPending((p) => [...p, data.attachment]);
      }
    } finally {
      setUploading(false);
    }
  }, []);

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
      await uploadFiles([file]);
    };
    recorder.start();
    setRecording(true);
  }

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const from = fromForFilter(dateFilter);
      if (from) params.set("from", from);
      if (jobId) params.set("job_id", jobId);
      const res = await fetch(`/api/direct-messages/conversations?${params}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, dateFilter, jobId]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/direct-messages/conversations/${id}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setActiveConv((c) => (data.conversation ? { id, other: data.conversation.other, last_message_at: null, last_message_preview: null, last_sender_id: null, unread: 0 } : c));
    loadConversations();
  }, [loadConversations]);

  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId, loadThread]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendReply() {
    if ((!reply.trim() && !pending.length) || !activeId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/direct-messages/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), importance, attachments: pending }),
      });
      if (res.ok) { setReply(""); setImportance("normal"); setPending([]); await loadThread(activeId); }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("flex overflow-hidden rounded-lg border border-border bg-card", className ?? "h-[calc(100vh-12rem)]")}>
      {/* Conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-9 pl-9 text-sm" placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Select className="h-8 flex-1 text-xs" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {DATE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            {canStart && (
              <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => setComposeOpen(true)}>
                <PenSquare className="h-4 w-4" /> New
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No messages yet.{canStart ? " Start a new message." : ""}</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn("flex w-full items-center gap-3 border-b border-border p-3 text-left transition hover:bg-muted/50", activeId === c.id && "bg-muted/60")}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                  {initials(c.other?.name ?? "?")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{c.other?.name ?? "Unknown"}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(c.last_message_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={cn("truncate text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {c.last_sender_id && c.last_sender_id !== (c.other?.id ?? "") ? "You: " : ""}{c.last_message_preview ?? c.other?.email}
                    </span>
                    {c.unread > 0 && <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{c.unread}</span>}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select a conversation to view messages.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{initials(activeConv?.other?.name ?? "?")}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeConv?.other?.name ?? "Conversation"}</p>
                <p className="truncate text-xs text-muted-foreground">{activeConv?.other?.email}</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[72%] rounded-2xl px-4 py-2 text-sm", m.mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-muted")}>
                    {m.importance !== "normal" && (
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        <span className={cn("h-1.5 w-1.5 rounded-full", IMPORTANCE_DOT[m.importance])} /> {m.importance}
                      </span>
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachments.length > 0 && (
                      <div className={cn("space-y-1.5", m.body && "mt-1.5")}>
                        {m.attachments.map((a, i) => <AttachmentView key={i} a={a} mine={m.mine} />)}
                      </div>
                    )}
                    <p className={cn("mt-1 text-[11px]", m.mine ? "text-accent-foreground/70" : "text-muted-foreground")}>{formatTime(m.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-border p-3">
              {(pending.length > 0 || uploading) && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pending.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
                      {a.type === "image" ? <Camera className="h-3.5 w-3.5" /> : a.type === "audio" ? <Mic className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="max-w-[140px] truncate">{a.name}</span>
                      <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {uploading && <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</span>}
                </div>
              )}
              <input ref={fileRef} type="file" multiple className="sr-only" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }} />
              <input ref={cameraRef} type="file" className="sr-only" accept="image/*" capture="environment" onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }} />
              {/* pr on the right keeps the Send button clear of the global
                  review FAB (fixed bottom-right) on the dashboard DM pages. */}
              <div className="flex items-center gap-2 sm:pr-16">
                <button type="button" title="Photo" onClick={() => cameraRef.current?.click()} className="text-muted-foreground transition hover:text-foreground"><Camera className="h-5 w-5" /></button>
                <button type="button" title="Attach file" onClick={() => fileRef.current?.click()} className="text-muted-foreground transition hover:text-foreground"><Paperclip className="h-5 w-5" /></button>
                <button type="button" title={recording ? "Stop recording" : "Voice note"} onClick={toggleRecording} className={cn("transition", recording ? "text-destructive" : "text-muted-foreground hover:text-foreground")}>{recording ? <StopCircle className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}</button>
                <div className="relative shrink-0">
                  <CircleDot className={cn("pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2", importance === "urgent" ? "text-destructive" : importance === "important" ? "text-accent" : "text-muted-foreground")} />
                  <Select menuPlacement="up" className="h-9 w-[130px] pl-7 text-xs" value={importance} onChange={(e) => setImportance(e.target.value as Importance)}>
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Message…"
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                />
                <Button onClick={() => void sendReply()} disabled={sending || uploading || (!reply.trim() && !pending.length)} size="icon"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>

      {composeOpen && (
        <NewMessageModal
          jobId={jobId}
          onClose={() => setComposeOpen(false)}
          onStarted={(id) => { setComposeOpen(false); loadConversations(); setActiveId(id); }}
        />
      )}
    </div>
  );
}

function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  if (a.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.name} className="max-h-52 w-full rounded-lg object-cover" /></a>
    );
  }
  if (a.type === "audio") return <audio controls src={a.url} className="w-full max-w-[240px]" />;
  if (a.type === "video") return <video controls src={a.url} className="max-h-52 w-full rounded-lg" />;
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs", mine ? "border-accent-foreground/30 bg-accent-foreground/10" : "border-border bg-background")}>
      <FileText className="h-4 w-4 shrink-0" />
      <span className="max-w-[180px] truncate">{a.name}</span>
    </a>
  );
}

function NewMessageModal({ jobId, onClose, onStarted }: { jobId?: string; onClose: () => void; onStarted: (conversationId: string) => void }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/direct-messages/users?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function start() {
    if (!picked) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: picked.id, body: body.trim() || undefined, job_id: jobId ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start conversation.");
      onStarted(data.conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start conversation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">New message</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          {picked ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2.5">
              <span className="text-sm"><span className="font-medium">{picked.name}</span> <span className="text-muted-foreground">· {picked.email}</span></span>
              <button onClick={() => setPicked(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <Input placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {users.map((u) => (
                  <button key={u.id} onClick={() => setPicked(u)} className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted/50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-[10px] font-semibold text-accent">{initials(u.name)}</span>
                    <span className="min-w-0"><span className="block truncate text-sm">{u.name}</span><span className="block truncate text-xs text-muted-foreground">{u.email}</span></span>
                  </button>
                ))}
                {!users.length && <p className="p-2 text-sm text-muted-foreground">No people found.</p>}
              </div>
            </>
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => void start()} disabled={!picked || busy}>{busy ? "Starting…" : "Send"}</Button>
        </div>
      </div>
    </div>
  );
}
