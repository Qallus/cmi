"use client";

import * as React from "react";
import {
  Mail, MessageSquare, Phone, Send, Plus, RefreshCw, Clock,
  CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message, MessageChannel } from "@/lib/communications/types";

type Tab = "all" | MessageChannel;

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "all",   label: "All",   icon: RefreshCw },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms",   label: "SMS",   icon: MessageSquare },
  { key: "call",  label: "Calls", icon: Phone },
];

function statusIcon(status: string) {
  if (status === "delivered" || status === "received") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "sent") return <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function channelIcon(channel: MessageChannel, size = "h-4 w-4") {
  if (channel === "email") return <Mail className={size} />;
  if (channel === "sms")   return <MessageSquare className={size} />;
  return <Phone className={size} />;
}

function formatDuration(secs: number | null) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface ComposePayload {
  channel: "email" | "sms";
  to: string;
  subject: string;
  body: string;
}

const EMPTY_COMPOSE: ComposePayload = { channel: "email", to: "", subject: "", body: "" };

export function CommunicationsClient({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [tab, setTab] = React.useState<Tab>("all");
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState<ComposePayload>(EMPTY_COMPOSE);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Message | null>(null);

  const filtered = tab === "all" ? messages : messages.filter((m) => m.channel === tab);

  const counts: Record<Tab, number> = {
    all:   messages.length,
    email: messages.filter((m) => m.channel === "email").length,
    sms:   messages.filter((m) => m.channel === "sms").length,
    call:  messages.filter((m) => m.channel === "call").length,
  };

  function openCompose(channel: "email" | "sms" = "email") {
    setDraft({ ...EMPTY_COMPOSE, channel });
    setSendError(null);
    setComposing(true);
  }

  async function send() {
    if (!draft.to) { setSendError("Recipient is required."); return; }
    if (draft.channel === "email" && !draft.subject) { setSendError("Subject is required for email."); return; }
    if (!draft.body) { setSendError("Message body is required."); return; }
    setSending(true); setSendError(null);
    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json() as Message & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessages((prev) => [json, ...prev]);
      setComposing(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally { setSending(false); }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Outreach</div>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight">Communications</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openCompose("sms")}>
            <MessageSquare className="h-3.5 w-3.5" /> New SMS
          </Button>
          <Button size="sm" variant="accent" onClick={() => openCompose("email")}>
            <Send className="h-3.5 w-3.5" /> Compose Email
          </Button>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex border-b border-border bg-card px-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px",
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {counts[key] > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                tab === key ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
              )}>{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex-1 overflow-y-auto divide-y divide-border", selected && "hidden md:block md:w-[360px] md:flex-none")}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card mb-4">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Send an email or SMS to get started. Messages will appear here.
              </p>
              <Button size="sm" variant="accent" className="mt-4" onClick={() => openCompose("email")}>
                <Plus className="h-3.5 w-3.5" /> Compose
              </Button>
            </div>
          ) : (
            filtered.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => setSelected(msg)}
                className={cn(
                  "w-full text-left px-5 py-4 transition hover:bg-muted/40",
                  selected?.id === msg.id && "bg-accent/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Channel badge */}
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.channel === "email" ? "bg-blue-500/10 text-blue-500" :
                    msg.channel === "sms"   ? "bg-green-500/10 text-green-500" :
                                              "bg-orange-500/10 text-orange-500"
                  )}>
                    {channelIcon(msg.channel, "h-4 w-4")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {msg.direction === "inbound"
                          ? <ArrowDownLeft className="h-3 w-3 text-success shrink-0" />
                          : <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="truncate text-sm font-medium">
                          {msg.direction === "inbound" ? msg.from_address : msg.to_address}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {statusIcon(msg.status)}
                        {timeAgo(msg.sent_at)}
                      </div>
                    </div>
                    {msg.subject && (
                      <div className="mt-0.5 text-sm font-medium truncate">{msg.subject}</div>
                    )}
                    {msg.channel === "call" ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Call · {formatDuration(msg.duration_seconds) ?? "—"}
                      </div>
                    ) : msg.body ? (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{msg.body}</div>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail pane */}
        {selected && (
          <div className="flex w-full flex-col border-l border-border md:w-auto md:flex-1">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  selected.channel === "email" ? "bg-blue-500/10 text-blue-500" :
                  selected.channel === "sms"   ? "bg-green-500/10 text-green-500" :
                                                  "bg-orange-500/10 text-orange-500"
                )}>
                  {channelIcon(selected.channel, "h-3.5 w-3.5")}
                </div>
                <span className="font-medium text-sm capitalize">{selected.channel}</span>
                <span className="text-xs text-muted-foreground">{selected.direction}</span>
              </div>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2 text-sm">
                {selected.to_address && <InfoRow label="To" value={selected.to_address} />}
                {selected.from_address && <InfoRow label="From" value={selected.from_address} />}
                {selected.subject && <InfoRow label="Subject" value={selected.subject} />}
                <InfoRow label="Status" value={selected.status} />
                <InfoRow label="Provider" value={selected.provider ?? "—"} />
                {selected.duration_seconds && <InfoRow label="Duration" value={formatDuration(selected.duration_seconds) ?? "—"} />}
                <InfoRow label="Sent" value={new Date(selected.sent_at).toLocaleString()} />
                {selected.error_message && (
                  <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{selected.error_message}</div>
                )}
              </div>
              {selected.body && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Message</div>
                  <div className="rounded-lg border border-border bg-background p-4 text-sm whitespace-pre-wrap leading-relaxed">{selected.body}</div>
                </div>
              )}
              {selected.channel !== "call" && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      openCompose(selected.channel as "email" | "sms");
                      setDraft((d) => ({
                        ...d,
                        channel: selected.channel as "email" | "sms",
                        to: (selected.direction === "inbound" ? selected.from_address : selected.to_address) ?? "",
                        subject: selected.subject ? `Re: ${selected.subject}` : "",
                      }));
                    }}
                  >
                    <Send className="h-3.5 w-3.5" /> Reply
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">
                {draft.channel === "email" ? "Compose Email" : "Send SMS"}
              </h2>
              <div className="flex items-center gap-3">
                {/* Channel toggle */}
                <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, channel: "email" }))}
                    className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 transition", draft.channel === "email" ? "bg-accent/15 text-accent" : "text-muted-foreground")}>
                    <Mail className="h-3 w-3" /> Email
                  </button>
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, channel: "sms" }))}
                    className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 transition", draft.channel === "sms" ? "bg-accent/15 text-accent" : "text-muted-foreground")}>
                    <MessageSquare className="h-3 w-3" /> SMS
                  </button>
                </div>
                <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setComposing(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {sendError && (
                <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{sendError}</div>
              )}
              <CF label="To">
                <input
                  className={iCls}
                  placeholder={draft.channel === "email" ? "recipient@example.com" : "+1 (602) 555-0100"}
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                />
              </CF>
              {draft.channel === "email" && (
                <CF label="Subject">
                  <input className={iCls} placeholder="Email subject…" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
                </CF>
              )}
              <CF label="Message">
                <textarea
                  className={cn(iCls, "min-h-[120px] resize-none")}
                  placeholder={draft.channel === "email" ? "Write your email…" : "Write your SMS (160 chars per segment)…"}
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                />
                {draft.channel === "sms" && draft.body && (
                  <div className="mt-1 text-right text-[11px] text-muted-foreground">
                    {draft.body.length} chars · {Math.ceil(draft.body.length / 160)} segment{Math.ceil(draft.body.length / 160) !== 1 ? "s" : ""}
                  </div>
                )}
              </CF>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setComposing(false)} disabled={sending}>Cancel</Button>
                <Button size="sm" variant="accent" onClick={() => void send()} disabled={sending}>
                  <Send className="h-3.5 w-3.5" />
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function CF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
