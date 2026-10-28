"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Mail, MessageSquare, Phone, Send, Plus, RefreshCw, Clock,
  CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, X,
  ClipboardList, ChevronDown, UserRound, LayoutTemplate, Users, Eye, Printer,
  Check, BriefcaseBusiness, Workflow, Archive, Trash2,
  ArchiveRestore, Copy, Forward, Reply, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-action";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import { cn } from "@/lib/utils";
import type { Message, MessageChannel } from "@/lib/communications/types";
import type { ContactSubmission, ContactSubmissionStatus } from "@/lib/contact-submissions/types";
import { TemplateManager } from "@/components/email-builder/template-manager";
import { PrintManager } from "@/components/print-builder/print-manager";
import { ComposeDialog, type ComposeInit } from "@/components/communications/compose-dialog";
import { CallsWorkspace } from "./calls-workspace";
import { SUBMISSION_ORDER_KEY } from "./submissions/[id]/submission-detail-client";

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
  canDelete = false,
}: {
  initialMessages: Message[];
  initialSubmissions: ContactSubmission[];
  serverNow?: number;
  /** Super Admin / Admin: may permanently delete message records. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const nowMs = useServerNow(serverNow);
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [submissions, setSubmissions] = React.useState<ContactSubmission[]>(initialSubmissions);
  const [tab, setTab] = React.useState<Tab>("all");
  // Deep-open a panel from the mobile quick-nav, e.g. ?panel=dialer / ?panel=email.
  const [newPrint, setNewPrint] = React.useState(false);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel") ?? params.get("tab");
    const map: Record<string, Tab> = { dialer: "call", call: "call", email: "email", sms: "sms", contact_form: "contact_form", templates: "templates", prints: "prints" };
    // eslint-disable-next-line -- one-time deep-link read on mount
    if (panel && map[panel]) setTab(map[panel]);
    if (map[panel ?? ""] === "prints" && params.get("new") === "1") setNewPrint(true);
  }, []);
  const [composeInit, setComposeInit] = React.useState<ComposeInit | null>(null);
  const [selected, setSelected] = React.useState<Message | null>(null);
  const [submissionFilter, setSubmissionFilter] = React.useState<ContactSubmissionStatus | "all" | "vendor_pitch" | "spam">("all");
  // Contact Form multi-select + action feedback.
  const [subSelected, setSubSelected] = React.useState<Set<string>>(new Set());
  const [subBusy, setSubBusy] = React.useState(false);
  const [subToast, setSubToast] = React.useState<string | null>(null);

  // Message list organization: Inbox vs Archived, received vs sent, multi-select.
  const [view, setView] = React.useState<"inbox" | "archived">("inbox");
  const [direction, setDirection] = React.useState<"all" | "inbound" | "outbound">("all");
  const [msgSelected, setMsgSelected] = React.useState<Set<string>>(new Set());
  const [msgBusy, setMsgBusy] = React.useState(false);
  const [msgToast, setMsgToast] = React.useState<string | null>(null);

  const active = messages.filter((m) => !m.archived_at);
  const archivedCount = messages.length - active.length;
  const filtered = messages.filter((m) =>
    (tab === "all" || m.channel === tab) &&
    (view === "archived" ? !!m.archived_at : !m.archived_at) &&
    (direction === "all" || m.direction === direction));

  // Spam is kept for review but never mixed into the inbox views.
  const isSpam = (s: ContactSubmission) => s.kind === "spam";
  const filteredSubmissions = submissionFilter === "spam"
    ? submissions.filter(isSpam)
    : submissionFilter === "vendor_pitch"
      ? submissions.filter((s) => s.kind === "vendor_pitch")
      : submissions.filter((s) => !isSpam(s) && (submissionFilter === "all" || s.status === submissionFilter));

  const newSubmissionsCount = submissions.filter((s) => s.status === "new" && !isSpam(s)).length;

  const counts: Record<Tab, number> = {
    all:          active.length,
    email:        active.filter((m) => m.channel === "email").length,
    sms:          active.filter((m) => m.channel === "sms").length,
    call:         active.filter((m) => m.channel === "call").length,
    contact_form: submissions.length,
    templates:    0,
    prints:       0,
  };

  function openCompose(channel: "email" | "sms" = "email") {
    setComposeInit({ channel });
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
    } catch {
      // silent fail -- optimistic update already applied
    }
  }

  // ── Message actions (row ⋯ menu, detail pane, bulk bar) ──
  const counterpart = (m: Message) => (m.direction === "inbound" ? m.from_address : m.to_address) ?? "";
  const plainBody = (m: Message) => (m.body ? (looksLikeHtml(m.body) ? htmlToText(m.body) : m.body) : "");

  function replyTo(m: Message) {
    if (m.channel === "call") { composeSmsTo(counterpart(m)); return; }
    const subject = m.subject ? (/^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`) : "";
    setComposeInit({ channel: m.channel, to: counterpart(m), subject });
  }

  function forward(m: Message) {
    const when = new Date(m.sent_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    setComposeInit({
      channel: "email",
      subject: m.subject ? (/^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`) : "Fwd:",
      body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from_address ?? ""}\nTo: ${m.to_address ?? ""}\nDate: ${when}\n${m.subject ? `Subject: ${m.subject}\n` : ""}\n${plainBody(m)}`,
    });
  }

  function flashMsg(text: string) {
    setMsgToast(text);
    window.setTimeout(() => setMsgToast((t) => (t === text ? null : t)), 3500);
  }

  async function copyMessage(m: Message) {
    try {
      await navigator.clipboard.writeText([m.subject, plainBody(m)].filter(Boolean).join("\n\n"));
      flashMsg("Message copied.");
    } catch { flashMsg("Couldn't copy the message."); }
  }

  async function organize(ids: string[], action: "archive" | "restore" | "delete") {
    if (!ids.length) return;
    if (action === "delete" && !(await confirmAction({
      title: ids.length === 1 ? "Permanently delete this message?" : `Permanently delete ${ids.length} messages?`,
      tone: "danger",
      body: "The message record is removed from Communications and the contact's history. It can't be restored. Archive instead to hide it but keep the record.",
    }))) return;
    setMsgBusy(true);
    try {
      const res = await fetch("/api/communications/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't update the messages.");
      const set = new Set(ids);
      const now = new Date().toISOString();
      setMessages((prev) => action === "delete"
        ? prev.filter((m) => !set.has(m.id))
        : prev.map((m) => (set.has(m.id) ? { ...m, archived_at: action === "archive" ? now : null } : m)));
      if (selected && set.has(selected.id)) setSelected(null);
      setMsgSelected(new Set());
      const n = ids.length === 1 ? "Message" : `${ids.length} messages`;
      flashMsg(action === "delete" ? `${n} deleted.` : action === "archive" ? `${n} archived.` : `${n} moved back to the Inbox.`);
    } catch (e) {
      flashMsg(e instanceof Error ? e.message : "Couldn't update the messages.");
    } finally {
      setMsgBusy(false);
    }
  }

  function messageActions(m: Message): RowAction[] {
    const archived = !!m.archived_at;
    return [
      { key: "open", label: "Open", icon: ExternalLink, run: () => setSelected(m) },
      { key: "reply", label: m.channel === "call" ? "Text back" : "Reply", icon: Reply, run: () => replyTo(m), hidden: !counterpart(m) },
      { key: "forward", label: "Forward", icon: Forward, run: () => forward(m), hidden: m.channel !== "email" },
      { key: "email", label: "Email", icon: Mail, run: () => setComposeInit({ channel: "email", to: m.contact?.email ?? (m.channel === "email" ? counterpart(m) : "") }), hidden: m.channel === "email" || !m.contact?.email },
      { key: "sms", label: "SMS", icon: MessageSquare, run: () => composeSmsTo(m.contact?.phone ?? (m.channel !== "email" ? counterpart(m) : "")), hidden: m.channel === "sms" || (!m.contact?.phone && m.channel === "email") },
      { key: "contact", label: "Open contact", icon: UserRound, run: () => router.push(`/dashboard/contacts?focus=${m.contact_id}`), hidden: !m.contact_id },
      { key: "copy", label: "Copy text", icon: Copy, run: () => void copyMessage(m), hidden: !m.body && !m.subject },
      archived
        ? { key: "restore", label: "Move to Inbox", icon: ArchiveRestore, run: () => void organize([m.id], "restore") }
        : { key: "archive", label: "Archive", icon: Archive, run: () => void organize([m.id], "archive") },
      { key: "delete", label: "Delete", icon: Trash2, run: () => void organize([m.id], "delete"), danger: true, hidden: !canDelete },
    ];
  }

  function toggleMsg(id: string) {
    setMsgSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAllMsgs() {
    setMsgSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((m) => m.id))));
  }

  function composeSmsTo(phone: string) {
    setComposeInit({ channel: "sms", to: phone });
  }

  // A submission opens its own page, not a modal: long enquiries were being
  // clipped at both ends, and these are the highest-value leads we get. The
  // page marks it read on arrival, so this only hands over the ordering the
  // list is currently showing, for the page's prev/next arrows.
  function openSubmission(sub: ContactSubmission) {
    try {
      window.sessionStorage.setItem(
        SUBMISSION_ORDER_KEY,
        JSON.stringify(filteredSubmissions.map((s) => s.id)),
      );
    } catch { /* the page falls back to its own ordering */ }
    router.push(`/dashboard/communications/submissions/${sub.id}`);
  }

  // ── Contact Form multi-select ──
  function toggleSub(id: string) {
    setSubSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAllSubs() {
    setSubSelected((prev) => prev.size === filteredSubmissions.length ? new Set() : new Set(filteredSubmissions.map((s) => s.id)));
  }
  function clearSubSelection() { setSubSelected(new Set()); }

  function flashToast(msg: string) {
    setSubToast(msg);
    window.setTimeout(() => setSubToast((t) => (t === msg ? null : t)), 3500);
  }

  async function bulkSubStatus(ids: string[], status: ContactSubmissionStatus) {
    if (!ids.length) return;
    setSubBusy(true);
    try {
      const res = await fetch("/api/contact-submissions", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed.");
      setSubmissions((prev) => prev.map((s) => ids.includes(s.id) ? { ...s, status } : s));
      flashToast(`Marked ${ids.length} as ${status}.`);
      clearSubSelection();
    } catch (e) { flashToast(e instanceof Error ? e.message : "Update failed."); }
    finally { setSubBusy(false); }
  }

  async function deleteSubs(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} submission${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setSubBusy(true);
    try {
      const res = await fetch("/api/contact-submissions", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed.");
      setSubmissions((prev) => prev.filter((s) => !ids.includes(s.id)));
      flashToast(`Deleted ${ids.length} submission${ids.length === 1 ? "" : "s"}.`);
      clearSubSelection();
    } catch (e) { flashToast(e instanceof Error ? e.message : "Delete failed."); }
    finally { setSubBusy(false); }
  }

  async function convertSubs(ids: string[], target: "contact" | "lead" | "deal") {
    if (!ids.length) return;
    setSubBusy(true);
    try {
      const res = await fetch("/api/contact-submissions/convert", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Conversion failed.");
      const label = target === "contact" ? "Contacts" : target === "lead" ? "Leads" : "Pipeline";
      flashToast(`Added ${ids.length} to ${label}.`);
      // Converting to a contact links contact_id — reflect that locally.
      if (target === "contact") {
        const map = new Map(ids.map((id, i) => [id, json.results?.[i]?.contactId as string | undefined]));
        setSubmissions((prev) => prev.map((s) => map.get(s.id) ? { ...s, contact_id: map.get(s.id) as string } : s));
      }
      clearSubSelection();
    } catch (e) { flashToast(e instanceof Error ? e.message : "Conversion failed."); }
    finally { setSubBusy(false); }
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
            onClick={() => { setTab(key); setSelected(null); setMsgSelected(new Set()); }}
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
          <PrintManager startNew={newPrint} />
        </div>
      ) : tab === "call" ? (
        <CallsWorkspace onSmsTo={composeSmsTo} />
      ) : tab === "contact_form" ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Sub-filter + toast */}
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {(["all", "new", "read", "archived", "vendor_pitch", "spam"] as const).map((f) => (
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
                  {f === "all" ? "All" : f === "vendor_pitch" ? "Vendor pitches" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              {subToast && <span className="ml-auto rounded-md bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{subToast}</span>}
            </div>

            {/* Bulk action bar (shown when rows are selected) */}
            {subSelected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/5 px-5 py-2.5">
                <span className="text-xs font-medium">{subSelected.size} selected</span>
                <div className="h-4 w-px bg-border" />
                <BulkBtn disabled={subBusy} onClick={() => convertSubs([...subSelected], "contact")} icon={UserRound}>To Contacts</BulkBtn>
                <BulkBtn disabled={subBusy} onClick={() => convertSubs([...subSelected], "lead")} icon={BriefcaseBusiness}>To Leads</BulkBtn>
                <BulkBtn disabled={subBusy} onClick={() => convertSubs([...subSelected], "deal")} icon={Workflow}>To Pipeline</BulkBtn>
                <div className="h-4 w-px bg-border" />
                <BulkBtn disabled={subBusy} onClick={() => bulkSubStatus([...subSelected], "read")} icon={Check}>Mark Read</BulkBtn>
                <BulkBtn disabled={subBusy} onClick={() => bulkSubStatus([...subSelected], "archived")} icon={Archive}>Archive</BulkBtn>
                <BulkBtn disabled={subBusy} onClick={() => deleteSubs([...subSelected])} icon={Trash2} danger>Delete</BulkBtn>
                <button type="button" onClick={clearSubSelection} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}

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
                    <th className="px-5 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={filteredSubmissions.length > 0 && subSelected.size === filteredSubmissions.length}
                        onChange={toggleAllSubs}
                      />
                    </th>
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
                        subSelected.has(sub.id) && "bg-accent/5",
                        sub.status === "new" && "font-medium"
                      )}
                    >
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${sub.first_name} ${sub.last_name}`} checked={subSelected.has(sub.id)} onChange={() => toggleSub(sub.id)} />
                      </td>
                      <td className="px-5 py-3.5">{submissionStatusBadge(sub.status)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {sub.first_name} {sub.last_name}
                        {sub.kind === "vendor_pitch" && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Vendor pitch</span>}
                        {sub.kind === "spam" && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive" title={sub.spam_reason ?? undefined}>Spam</span>}
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
          <div className={cn("flex-1 overflow-y-auto", selected && "hidden md:block md:w-[360px] md:flex-none")}>
            {/* View + filter bar, or the bulk bar while messages are selected */}
            <div className="sticky top-0 z-10 flex min-h-[49px] flex-wrap items-center gap-2 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur">
              <input
                type="checkbox" aria-label="Select all shown messages" className="h-4 w-4"
                checked={filtered.length > 0 && msgSelected.size === filtered.length}
                ref={(el) => { if (el) el.indeterminate = msgSelected.size > 0 && msgSelected.size < filtered.length; }}
                onChange={toggleAllMsgs} disabled={filtered.length === 0}
              />
              {msgSelected.size > 0 ? (
                <>
                  <span className="text-xs font-medium">{msgSelected.size} selected</span>
                  {view === "inbox"
                    ? <BulkBtn disabled={msgBusy} onClick={() => void organize([...msgSelected], "archive")} icon={Archive}>Archive</BulkBtn>
                    : <BulkBtn disabled={msgBusy} onClick={() => void organize([...msgSelected], "restore")} icon={ArchiveRestore}>Move to Inbox</BulkBtn>}
                  {canDelete && <BulkBtn disabled={msgBusy} onClick={() => void organize([...msgSelected], "delete")} icon={Trash2} danger>Delete</BulkBtn>}
                  <button type="button" onClick={() => setMsgSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </>
              ) : (
                <>
                  {(["inbox", "archived"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => { setView(v); setSelected(null); }}
                      className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                        view === v ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
                      {v === "inbox" ? "Inbox" : `Archived${archivedCount ? ` (${archivedCount})` : ""}`}
                    </button>
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" />
                  {([["all", "All"], ["inbound", "Received"], ["outbound", "Sent"]] as const).map(([d, l]) => (
                    <button key={d} type="button" onClick={() => setDirection(d)}
                      className={cn("rounded-full px-2 py-0.5 text-xs transition",
                        direction === d ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {l}
                    </button>
                  ))}
                </>
              )}
              {msgToast && <span className="ml-auto rounded-md bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{msgToast}</span>}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card mb-4">
                  {view === "archived" ? <Archive className="h-6 w-6 text-muted-foreground" /> : <Mail className="h-6 w-6 text-muted-foreground" />}
                </div>
                <p className="text-sm font-medium">{view === "archived" ? "Nothing archived" : direction !== "all" ? "No messages match this filter" : "No messages yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  {view === "archived"
                    ? "Archived messages are kept here, out of the Inbox. Use ⋯ → Archive on any message."
                    : "Send an email or SMS to get started. Messages will appear here."}
                </p>
                {view === "inbox" && (
                  <Button size="sm" variant="accent" className="mt-4" onClick={() => openCompose("email")}>
                    <Plus className="h-3.5 w-3.5" /> Compose
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
              {filtered.map((msg) => (
                <div
                  key={msg.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(msg)}
                  onKeyDown={(e) => { if (e.key === "Enter") setSelected(msg); }}
                  className={cn(
                    "group w-full cursor-pointer text-left px-5 py-4 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40",
                    (selected?.id === msg.id || msgSelected.has(msg.id)) && "bg-accent/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox" aria-label="Select message" className="mt-2 h-4 w-4 shrink-0"
                      checked={msgSelected.has(msg.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleMsg(msg.id)}
                    />
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
                          <RowActionsMenu items={messageActions(msg)} label={`Actions for message ${msg.subject ?? counterpart(msg)}`} className="-my-1" />
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
                </div>
              ))}
              </div>
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
                <div className="flex flex-wrap gap-2 pt-2" role="toolbar" aria-label="Message actions">
                  {counterpart(selected) && (
                    <Button size="sm" variant="accent" onClick={() => replyTo(selected)}>
                      <Reply className="h-3.5 w-3.5" /> {selected.channel === "call" ? "Text back" : "Reply"}
                    </Button>
                  )}
                  {selected.channel === "email" && (
                    <Button size="sm" variant="outline" onClick={() => forward(selected)}>
                      <Forward className="h-3.5 w-3.5" /> Forward
                    </Button>
                  )}
                  {selected.archived_at ? (
                    <Button size="sm" variant="outline" disabled={msgBusy} onClick={() => void organize([selected.id], "restore")}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Move to Inbox
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={msgBusy} onClick={() => void organize([selected.id], "archive")}>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="outline" disabled={msgBusy} className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void organize([selected.id], "delete")}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                  <RowActionsMenu items={messageActions(selected).filter((a) => !["open", "reply", "forward", "archive", "restore", "delete"].includes(a.key))} label="More message actions" className="self-center" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {composeInit && (
        <ComposeDialog init={composeInit} onClose={() => setComposeInit(null)} onSent={(sent) => setMessages((prev) => [...sent, ...prev])} />
      )}

    </div>
  );
}

function BulkBtn({ children, icon: Icon, onClick, disabled, danger }: { children: React.ReactNode; icon: React.ElementType; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50",
        danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:border-accent/40 hover:text-accent",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
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
