"use client";

import * as React from "react";
import {
  Mail, MessageSquare, Phone, Send, Plus, RefreshCw, Clock,
  CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, X,
  ClipboardList, ChevronDown, UserRound, LayoutTemplate, Users, Eye, Printer,
  Check, HardHat, FolderKanban, BriefcaseBusiness, ExternalLink, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message, MessageChannel } from "@/lib/communications/types";
import type { ContactSubmission, ContactSubmissionStatus } from "@/lib/contact-submissions/types";
import { CONTACT_TYPES, type ContactType } from "@/lib/contacts/types";
import { TemplateManager } from "@/components/email-builder/template-manager";
import { PrintManager } from "@/components/print-builder/print-manager";
import { DynamicFieldsBar } from "@/components/ui/dynamic-fields-bar";
import { CallsWorkspace } from "./calls-workspace";

type Tab = "all" | MessageChannel | "contact_form" | "templates" | "prints";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "all",          label: "All",          icon: RefreshCw },
  { key: "email",        label: "Email",         icon: Mail },
  { key: "sms",          label: "SMS",           icon: MessageSquare },
  { key: "call",         label: "Calls",         icon: Phone },
  { key: "contact_form", label: "Contact Form",  icon: ClipboardList },
  { key: "templates",    label: "Templates",     icon: LayoutTemplate },
  { key: "prints",       label: "Prints",        icon: Printer },
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

function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

// Strip HTML to a readable plain-text snippet for list previews.
function htmlToText(s: string) {
  return s
    .replace(/<(style|head|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rarr;/gi, "→")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Render a stored email body as the actual email, sandboxed (no scripts),
// with auto-fit height.
function EmailFrame({ html }: { html: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(360);
  function fit() {
    const doc = ref.current?.contentWindow?.document;
    if (doc?.body) setHeight(Math.min(Math.max(doc.body.scrollHeight + 24, 200), 2400));
  }
  return (
    <iframe
      ref={ref}
      title="Email preview"
      srcDoc={html}
      onLoad={fit}
      sandbox="allow-same-origin"
      className="w-full rounded-lg border border-border bg-white"
      style={{ height }}
    />
  );
}

function timeAgo(iso: string, nowMs: number = Date.now()) {
  const diff = nowMs - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function submissionStatusBadge(status: ContactSubmissionStatus) {
  if (status === "new")      return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">New</span>;
  if (status === "read")     return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Read</span>;
  if (status === "archived") return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground/60">Archived</span>;
}

interface ComposePayload {
  channel: "email" | "sms";
  to: string;
  subject: string;
  body: string;
}

const EMPTY_COMPOSE: ComposePayload = { channel: "email", to: "", subject: "", body: "" };

// "Now" anchored to the server clock (passed from the server-rendered page),
// so relative times stay correct even if the viewer's computer clock is off.
// Only the elapsed time since mount is taken from the local clock.
function useServerNow(serverNow?: number) {
  const offsetRef = React.useRef<number>(serverNow ? serverNow - Date.now() : 0);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  return Date.now() + offsetRef.current;
}

export function CommunicationsClient({
  initialMessages,
  initialSubmissions,
  serverNow,
}: {
  initialMessages: Message[];
  initialSubmissions: ContactSubmission[];
  serverNow?: number;
}) {
  const nowMs = useServerNow(serverNow);
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [submissions, setSubmissions] = React.useState<ContactSubmission[]>(initialSubmissions);
  const [tab, setTab] = React.useState<Tab>("all");
  // Deep-open a panel from the mobile quick-nav, e.g. ?panel=dialer / ?panel=email.
  React.useEffect(() => {
    const panel = new URLSearchParams(window.location.search).get("panel");
    const map: Record<string, Tab> = { dialer: "call", call: "call", email: "email", sms: "sms", contact_form: "contact_form" };
    // eslint-disable-next-line -- one-time deep-link read on mount
    if (panel && map[panel]) setTab(map[panel]);
  }, []);
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState<ComposePayload>(EMPTY_COMPOSE);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Message | null>(null);
  const [selectedSubmission, setSelectedSubmission] = React.useState<ContactSubmission | null>(null);
  const [submissionFilter, setSubmissionFilter] = React.useState<ContactSubmissionStatus | "all">("all");

  // Compose: multi-recipient + template state
  const [recipientTags, setRecipientTags] = React.useState<string[]>([]);
  const [recipientInput, setRecipientInput] = React.useState("");
  const [composeTemplates, setComposeTemplates] = React.useState<{ id: string; name: string; subject: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<{ id: string; name: string; subject: string; html: string } | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const templateMenuRef = React.useRef<HTMLDivElement>(null);
  const bodyTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  function insertIntoBody(token: string) {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end   = el.selectionEnd   ?? 0;
    const next  = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft(d => ({ ...d, body: next }));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = tab === "all" ? messages : messages.filter((m) => m.channel === tab);

  const filteredSubmissions = submissionFilter === "all"
    ? submissions
    : submissions.filter((s) => s.status === submissionFilter);

  const newSubmissionsCount = submissions.filter((s) => s.status === "new").length;

  const counts: Record<Tab, number> = {
    all:          messages.length,
    email:        messages.filter((m) => m.channel === "email").length,
    sms:          messages.filter((m) => m.channel === "sms").length,
    call:         messages.filter((m) => m.channel === "call").length,
    contact_form: submissions.length,
    templates:    0,
    prints:       0,
  };

  function openCompose(channel: "email" | "sms" = "email") {
    setDraft({ ...EMPTY_COMPOSE, channel });
    setSendError(null);
    setRecipientTags([]);
    setRecipientInput("");
    setSelectedTemplate(null);
    setShowTemplateMenu(false);
    setShowTemplatePreview(false);
    setComposing(true);
    if (channel === "email") {
      fetch("/api/admin/email-templates")
        .then(r => r.json())
        .then((data: { templates?: { id: string; name: string; subject: string; html: string; status: string }[] }) => {
          setComposeTemplates((data.templates ?? []).filter(t => t.status === "active"));
        })
        .catch(() => {});
    }
  }

  function addRecipientTag(raw = recipientInput) {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!emails.length) { setRecipientInput(""); return; }
    setRecipientTags(prev => Array.from(new Set([...prev, ...emails])));
    setRecipientInput("");
  }

  async function send() {
    const body = selectedTemplate ? selectedTemplate.html : draft.body;
    // Collect all recipients: tags + single `to` field
    const pendingInput = recipientInput.trim();
    const allEmails = Array.from(new Set([
      ...recipientTags,
      ...(pendingInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingInput) ? [pendingInput] : []),
      ...(draft.to.trim() && !recipientTags.length && !pendingInput ? [draft.to.trim()] : []),
    ]));
    if (allEmails.length === 0 && !draft.to.trim()) { setSendError("Recipient is required."); return; }
    const recipients = allEmails.length > 0 ? allEmails : [draft.to.trim()];
    if (draft.channel === "email" && !draft.subject) { setSendError("Subject is required for email."); return; }
    if (!body) { setSendError("Message body is required."); return; }
    setSending(true); setSendError(null);
    try {
      const results = await Promise.all(
        recipients.map(to =>
          fetch("/api/communications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, to, body }),
          }).then(r => r.json() as Promise<Message & { error?: string }>)
        )
      );
      const sent = results.filter(r => r.id && !r.error);
      if (sent.length === 0) throw new Error((results[0] as { error?: string }).error ?? "Send failed.");
      setMessages((prev) => [...sent, ...prev]);
      setComposing(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally { setSending(false); }
  }

  async function updateSubmissionStatus(id: string, status: ContactSubmissionStatus) {
    try {
      await fetch("/api/contact-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setSubmissions((prev) =>
        prev.map((s) => s.id === id ? { ...s, status } : s)
      );
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev) => prev ? { ...prev, status } : prev);
      }
    } catch {
      // silent fail -- optimistic update already applied
    }
  }

  function composeSmsTo(phone: string) {
    openCompose("sms");
    setDraft((d) => ({ ...d, channel: "sms", to: phone }));
  }

  function openSubmission(sub: ContactSubmission) {
    setSelectedSubmission(sub);
    if (sub.status === "new") {
      void updateSubmissionStatus(sub.id, "read");
    }
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
          <Button size="sm" variant="outline" onClick={() => setTab("call")}>
            <Phone className="h-3.5 w-3.5" /> New Call
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCompose("sms")}>
            <MessageSquare className="h-3.5 w-3.5" /> New SMS
          </Button>
          <Button size="sm" variant="accent" onClick={() => openCompose("email")}>
            <Send className="h-3.5 w-3.5" /> Compose Email
          </Button>
        </div>
      </div>

      {/* Channel tabs — scroll horizontally on mobile instead of wrapping */}
      <div className="flex overflow-x-auto border-b border-border bg-card px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setSelected(null); setSelectedSubmission(null); }}
            className={cn(
              "flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap",
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === "contact_form" && newSubmissionsCount > 0 ? (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                tab === key ? "bg-accent/15 text-accent" : "bg-accent/15 text-accent"
              )}>{newSubmissionsCount}</span>
            ) : counts[key] > 0 ? (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                tab === key ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
              )}>{counts[key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <div className="flex-1 overflow-hidden">
          <TemplateManager />
        </div>
      ) : tab === "prints" ? (
        <div className="flex-1 overflow-hidden">
          <PrintManager />
        </div>
      ) : tab === "call" ? (
        <CallsWorkspace onSmsTo={composeSmsTo} />
      ) : tab === "contact_form" ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Sub-filter */}
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {(["all", "new", "read", "archived"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSubmissionFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[12px] font-medium transition border",
                    submissionFilter === f
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                  )}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                  <ClipboardList className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No submissions yet</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Contact form submissions from your website will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Message</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => openSubmission(sub)}
                      className={cn(
                        "cursor-pointer transition hover:bg-muted/40",
                        selectedSubmission?.id === sub.id && "bg-accent/5",
                        sub.status === "new" && "font-medium"
                      )}
                    >
                      <td className="px-5 py-3.5">{submissionStatusBadge(sub.status)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {sub.first_name} {sub.last_name}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{sub.email}</td>
                      <td className="px-5 py-3.5 max-w-[200px] truncate">{sub.subject}</td>
                      <td className="px-5 py-3.5 max-w-[260px]">
                        <span className="line-clamp-1 text-muted-foreground">{sub.message}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        {timeAgo(sub.submitted_at, nowMs)}
                      </td>
                      <td className="px-5 py-3.5">
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Original message list + detail pane */
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
                          {timeAgo(msg.sent_at, nowMs)}
                        </div>
                      </div>
                      {msg.subject && (
                        <div className="mt-0.5 text-sm font-medium truncate">{msg.subject}</div>
                      )}
                      {msg.channel === "call" ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {"Call | "}{formatDuration(msg.duration_seconds) ?? "--"}
                        </div>
                      ) : msg.body ? (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{looksLikeHtml(msg.body) ? htmlToText(msg.body) : msg.body}</div>
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
                  <InfoRow label="Provider" value={selected.provider ?? "--"} />
                  {selected.duration_seconds && <InfoRow label="Duration" value={formatDuration(selected.duration_seconds) ?? "--"} />}
                  <InfoRow label="Sent" value={new Date(selected.sent_at).toLocaleString()} />
                  {selected.error_message && (
                    <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{selected.error_message}</div>
                  )}
                </div>
                {selected.body && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Message</div>
                    {looksLikeHtml(selected.body) ? (
                      <EmailFrame html={selected.body} />
                    ) : (
                      <div className="rounded-lg border border-border bg-background p-4 text-sm whitespace-pre-wrap leading-relaxed">{selected.body}</div>
                    )}
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
      )}

      {/* Compose modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">{draft.channel === "email" ? "Compose Email" : "Send SMS"}</h2>
              <div className="flex items-center gap-3">
                <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                  <button type="button"
                    onClick={() => { setDraft((d) => ({ ...d, channel: "email" })); if (!composeTemplates.length) { fetch("/api/admin/email-templates").then(r => r.json()).then((data: { templates?: { id: string; name: string; subject: string; html: string; status: string }[] }) => setComposeTemplates((data.templates ?? []).filter(t => t.status === "active"))).catch(() => {}); } }}
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
              {sendError && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{sendError}</div>}

              {/* To -- multi-recipient tag input */}
              <CF label={`To${recipientTags.length > 1 ? ` (${recipientTags.length} recipients)` : ""}`}>
                <div className="min-h-[36px] w-full rounded-md border border-border bg-background px-2.5 py-1.5 focus-within:border-accent">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recipientTags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                        {tag}
                        <button type="button" onClick={() => setRecipientTags(prev => prev.filter(t => t !== tag))}>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      placeholder={recipientTags.length > 0 ? "Add more..." : draft.channel === "email" ? "name@example.com" : "+1 (602) 555-0100"}
                      value={recipientTags.length > 0 ? recipientInput : draft.to}
                      onChange={(e) => recipientTags.length > 0 ? setRecipientInput(e.target.value) : setDraft(d => ({ ...d, to: e.target.value }))}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === "," || e.key === " ") && draft.channel === "email") {
                          e.preventDefault();
                          const val = recipientTags.length > 0 ? recipientInput : draft.to;
                          if (val.trim()) { addRecipientTag(val); if (recipientTags.length === 0) setDraft(d => ({ ...d, to: "" })); }
                        }
                      }}
                      onBlur={() => {
                        const val = recipientTags.length > 0 ? recipientInput : draft.to;
                        if (val.trim() && draft.channel === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
                          addRecipientTag(val);
                          if (recipientTags.length === 0) setDraft(d => ({ ...d, to: "" }));
                        }
                      }}
                    />
                  </div>
                </div>
                {draft.channel === "email" && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Add group:</span>
                    {([
                      { label: "All Contacts", value: "contacts" },
                      { label: "All Staff", value: "staff" },
                    ] as const).map(({ label, value }) => (
                      <button key={value} type="button"
                        onClick={() => {
                          const tag = `group:${value}`;
                          setRecipientTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                        }}
                        className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
                          recipientTags.includes(`group:${value}`) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                        )}>
                        <Users className="h-2.5 w-2.5" /> {label}
                      </button>
                    ))}
                  </div>
                )}
              </CF>

              {/* Subject + Template picker */}
              {draft.channel === "email" && (
                <CF label="Subject">
                  <div className="flex gap-2">
                    <input
                      className={cn(iCls, "flex-1")}
                      placeholder="Email subject..."
                      value={draft.subject}
                      onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                    />
                    {composeTemplates.length > 0 && (
                      <div className="relative shrink-0" ref={templateMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowTemplateMenu(v => !v)}
                          className={cn("flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition h-9",
                            selectedTemplate ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                          )}
                        >
                          <LayoutTemplate className="h-3 w-3" />
                          {selectedTemplate ? selectedTemplate.name : "Template"}
                          <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplateMenu && "rotate-180")} />
                        </button>
                        {showTemplateMenu && (
                          <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                            {selectedTemplate && (
                              <button type="button" onClick={() => { setSelectedTemplate(null); setShowTemplateMenu(false); setDraft(d => ({ ...d, subject: "", body: "" })); }}
                                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                                <X className="h-3 w-3" /> Clear template
                              </button>
                            )}
                            <div className="max-h-48 overflow-y-auto py-1">
                              {composeTemplates.map(t => (
                                <button key={t.id} type="button"
                                  onClick={() => {
                                    setShowTemplateMenu(false);
                                    setLoadingTemplate(true);
                                    fetch(`/api/admin/email-templates/${t.id}`)
                                      .then(r => r.json() as Promise<{ template: { id: string; name: string; subject: string; html: string } }>)
                                      .then(data => {
                                        setSelectedTemplate({ id: data.template.id, name: data.template.name, subject: data.template.subject, html: data.template.html ?? "" });
                                        setDraft(d => ({ ...d, subject: data.template.subject || d.subject }));
                                        setShowTemplatePreview(true);
                                      })
                                      .catch(() => setSendError("Failed to load template."))
                                      .finally(() => setLoadingTemplate(false));
                                  }}
                                  className={cn("flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-xs transition hover:bg-muted",
                                    selectedTemplate?.id === t.id && "bg-accent/5 text-accent"
                                  )}>
                                  <span className="font-semibold">{t.name}</span>
                                  {t.subject && <span className="text-muted-foreground truncate">{t.subject}</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CF>
              )}

              {/* Message / template preview */}
              <CF label={loadingTemplate ? "Loading template..." : selectedTemplate ? "Template Preview" : "Message"}>
                {loadingTemplate ? (
                  <div className="flex h-16 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
                    Loading template...
                  </div>
                ) : selectedTemplate ? (
                  <div className="overflow-hidden rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
                      <span className="text-[11px] text-muted-foreground">Using: <strong className="text-foreground">{selectedTemplate.name}</strong></span>
                      <button type="button" onClick={() => setShowTemplatePreview(v => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        <Eye className="h-3 w-3" /> {showTemplatePreview ? "Hide" : "Show"} preview
                      </button>
                    </div>
                    {showTemplatePreview && (
                      <iframe
                        srcDoc={selectedTemplate.html || "<p style='padding:16px;color:#888;font-family:sans-serif;font-size:13px'>No HTML content in this template.</p>"}
                        className="h-64 w-full bg-white"
                        title="Template preview"
                        sandbox="allow-same-origin"
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <DynamicFieldsBar onInsert={insertIntoBody} />
                    <textarea
                      ref={bodyTextareaRef}
                      className={cn(iCls, "min-h-[120px] resize-y")}
                      placeholder={draft.channel === "email" ? "Write your email..." : "Write your SMS (160 chars per segment)..."}
                      value={draft.body}
                      onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    />
                    {draft.channel === "sms" && draft.body && (
                      <div className="mt-1 text-right text-[11px] text-muted-foreground">
                        {draft.body.length}{" chars | "}{Math.ceil(draft.body.length / 160)} segment{Math.ceil(draft.body.length / 160) !== 1 ? "s" : ""}
                      </div>
                    )}
                  </>
                )}
              </CF>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  {recipientTags.length > 1 ? `Sending to ${recipientTags.length} recipients` : ""}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setComposing(false)} disabled={sending}>Cancel</Button>
                  <Button size="sm" variant="accent" onClick={() => void send()} disabled={sending}>
                    <Send className="h-3.5 w-3.5" />
                    {sending ? "Sending..." : recipientTags.length > 1 ? `Send to ${recipientTags.length}` : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission detail modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedSubmission(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-card shadow-xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-sm">Contact Form Submission</span>
                  {submissionStatusBadge(selectedSubmission.status)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted {new Date(selectedSubmission.submitted_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedSubmission(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <ModalField label="First Name" value={selectedSubmission.first_name} />
                <ModalField label="Last Name" value={selectedSubmission.last_name} />
                <ContactActionField label="Email" value={selectedSubmission.email} email={selectedSubmission.email} contactId={selectedSubmission.contact_id} />
                <ContactActionField label="Phone" value={selectedSubmission.phone ?? "--"} phone={selectedSubmission.phone} contactId={selectedSubmission.contact_id} />
                <ModalField label="How They Heard" value={selectedSubmission.how_heard ?? "--"} />
                <ModalField label="Subject" value={selectedSubmission.subject} />
                {formatSubmissionAddress(selectedSubmission) && (
                  <ModalField label="Project Address" value={formatSubmissionAddress(selectedSubmission)} />
                )}
                {selectedSubmission.project_budget && (
                  <ModalField label="Project Budget" value={selectedSubmission.budget_amount || selectedSubmission.project_budget} />
                )}
              </div>

              {selectedSubmission.project_status?.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Project Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSubmission.project_status.map((s) => (
                      <span key={s} className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Message</div>
                <div className="rounded-lg border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

              {/* Assign / route */}
              <AssignPanel submission={selectedSubmission} />

              {/* Status actions */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Mark as:</span>
                  {(["new", "read", "archived"] as ContactSubmissionStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={selectedSubmission.status === s}
                      onClick={() => void updateSubmissionStatus(selectedSubmission.id, s)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12px] font-medium transition",
                        selectedSubmission.status === s
                          ? "border-accent bg-accent/10 text-accent cursor-default"
                          : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                      )}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => {
                    openCompose("email");
                    setDraft({
                      channel: "email",
                      to: selectedSubmission.email,
                      subject: `Re: ${selectedSubmission.subject}`,
                      body: "",
                    });
                    setSelectedSubmission(null);
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Reply by Email
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

function ModalField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ContactActionField({
  label,
  value,
  email,
  phone,
  contactId,
}: {
  label: string;
  value: string;
  email?: string | null;
  phone?: string | null;
  contactId?: string | null;
}) {
  const profileHref = contactId ? `/dashboard/contacts?id=${encodeURIComponent(contactId)}` : email ? `/dashboard/contacts?search=${encodeURIComponent(email)}` : "/dashboard/contacts";
  return (
    <div className="group relative">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <a href={email ? `mailto:${email}` : phone ? `tel:${phone}` : profileHref} className="text-sm font-medium text-foreground underline-offset-4 transition hover:text-accent hover:underline">
        {value}
      </a>
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden min-w-44 rounded-lg border border-border bg-card p-1 text-xs shadow-xl group-hover:block group-hover:pointer-events-auto">
        {email ? (
          <a href={`mailto:${email}`} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-muted">
            <Mail className="h-3.5 w-3.5 text-accent" /> Email
          </a>
        ) : null}
        {phone ? (
          <a href={`tel:${phone}`} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-muted">
            <Phone className="h-3.5 w-3.5 text-accent" /> Call
          </a>
        ) : null}
        <a href={profileHref} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-muted">
          <UserRound className="h-3.5 w-3.5 text-accent" /> Contact profile
        </a>
      </div>
    </div>
  );
}

function formatSubmissionAddress(s: ContactSubmission): string {
  const l1 = [s.address_line1, s.address_line2].filter(Boolean).join(", ");
  const cityState = [s.city, s.state].filter(Boolean).join(", ");
  const l2 = [cityState, s.zip].filter(Boolean).join(" ");
  return [l1, l2].filter(Boolean).join(" · ");
}

// Route a submission onward: tag the linked contact (Lead / Client / Vendor / …)
// and jump into the workspace where the next record lives (Pre-Con, Jobs,
// Projects). The contact profile is the hub — every downstream record links back
// to it — so we deep-link there with the contact pre-selected.
function AssignPanel({ submission }: { submission: ContactSubmission }) {
  const contactId = submission.contact_id;
  const [assignedType, setAssignedType] = React.useState<ContactType | null>(null);
  const [saving, setSaving] = React.useState<ContactType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function assignType(type: ContactType) {
    if (!contactId) return;
    setSaving(type); setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      setAssignedType(type);
    } catch {
      setError("Couldn't update. Try again.");
    } finally {
      setSaving(null);
    }
  }

  const profileHref = contactId
    ? `/dashboard/contacts?id=${encodeURIComponent(contactId)}`
    : `/dashboard/contacts?search=${encodeURIComponent(submission.email)}`;
  const q = contactId ? `?contact=${encodeURIComponent(contactId)}` : "";

  const routes: { label: string; href: string; icon: React.ElementType }[] = [
    { label: "Contact Profile", href: profileHref, icon: UserRound },
    { label: "Pre-Con", href: `/dashboard/sales${q}`, icon: BriefcaseBusiness },
    { label: "New Job", href: `/dashboard/jobs/new${q}`, icon: HardHat },
    { label: "Projects", href: `/dashboard/project-manager${q}`, icon: FolderKanban },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Tag className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Assign / Route</span>
      </div>

      {/* Tag the linked contact */}
      <div className="mb-3">
        <div className="mb-1.5 text-xs text-muted-foreground">
          Tag {submission.first_name || "this contact"} as:
        </div>
        {!contactId ? (
          <p className="text-xs text-muted-foreground">
            No linked contact record — open the contact profile to create one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {CONTACT_TYPES.map((type) => {
              const active = assignedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void assignType(type)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition disabled:opacity-60",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                  {saving === type ? "Saving…" : type}
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>

      {/* Jump to a workspace */}
      <div>
        <div className="mb-1.5 text-xs text-muted-foreground">Open in:</div>
        <div className="flex flex-wrap gap-1.5">
          {routes.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          ))}
        </div>
      </div>
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

