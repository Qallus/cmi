"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, ClipboardList, Copy,
  ExternalLink, FolderKanban, HardHat, Loader2, Mail, MapPin, MessageSquare, Phone,
  Send, Tag, Trash2, UserRound, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CONTACT_TYPES, type ContactType } from "@/lib/contacts/types";
import type { ContactSubmission, ContactSubmissionStatus } from "@/lib/contact-submissions/types";
import type { ThreadMessage } from "@/lib/contact-submissions/data";
import {
  SUBMISSION_STATUSES, composeLinks, displayPhone, formatSubmissionAddress, statusLabel,
  statusTone, submissionBudget, submissionInitials, submissionName, telHref,
} from "@/lib/contact-submissions/present";

/** Shared with the list, which writes the order it is currently showing. */
export const SUBMISSION_ORDER_KEY = "cmi-submission-order";

const LIST_HREF = "/dashboard/communications?panel=contact_form";

export function SubmissionDetailClient({
  submission: initial, fallbackOrder, thread, canConvert,
}: {
  submission: ContactSubmission;
  fallbackOrder: string[];
  thread: ThreadMessage[];
  canConvert: boolean;
}) {
  const router = useRouter();
  const [submission, setSubmission] = React.useState(initial);
  const [siblings, setSiblings] = React.useState<string[]>(fallbackOrder);
  const [busy, setBusy] = React.useState(false);
  // Lifted so the SMS quick action can switch the composer, not just scroll to it.
  const [replyChannel, setReplyChannel] = React.useState<"email" | "sms">("email");
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const name = submissionName(submission);
  const address = formatSubmissionAddress(submission);
  const budget = submissionBudget(submission);
  const tel = telHref(submission.phone);

  // Prefer the ordering the list was actually showing, so the arrows walk the
  // filtered set rather than every submission ever received.
  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SUBMISSION_ORDER_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as unknown;
      if (Array.isArray(ids) && ids.includes(submission.id)) setSiblings(ids as string[]);
    } catch { /* fall back to the server ordering */ }
    // eslint-disable-next-line -- one-time adoption of the list's ordering on mount
  }, [submission.id]);

  const at = siblings.indexOf(submission.id);
  const prevId = at > 0 ? siblings[at - 1] : null;
  const nextId = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null;

  // Opening a new submission is what marks it read — the same thing the modal
  // used to do, so the bell and this page agree.
  const markedRef = React.useRef(false);
  React.useEffect(() => {
    if (markedRef.current || initial.status !== "new") return;
    markedRef.current = true;
    void fetch("/api/contact-submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: initial.id, status: "read" }),
    })
      .then(() => setSubmission((s) => (s.status === "new" ? { ...s, status: "read" } : s)))
      .catch(() => { /* the badge is cosmetic; the submission still opened */ });
  }, [initial.id, initial.status]);

  const go = React.useCallback((id: string | null) => {
    if (id) router.push(`/dashboard/communications/submissions/${id}`);
  }, [router]);

  // Keyboard, the way a mail client works: walk the queue without the mouse.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowRight") { e.preventDefault(); go(nextId); }
      if (e.key === "k" || e.key === "ArrowLeft") { e.preventDefault(); go(prevId); }
      if (e.key === "Escape") { e.preventDefault(); router.push(LIST_HREF); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, nextId, prevId, router]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function setStatus(status: ContactSubmissionStatus) {
    const previous = submission.status;
    setSubmission((s) => ({ ...s, status }));
    try {
      const res = await fetch("/api/contact-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submission.id, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubmission((s) => ({ ...s, status: previous }));
      setError("Couldn't change the status. Try again.");
    }
  }

  async function convert(target: "contact" | "lead" | "deal") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/contact-submissions/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [submission.id], target }),
      });
      const json = (await res.json()) as { error?: string; results?: { contactId?: string }[] };
      if (!res.ok) throw new Error(json.error || "That didn't work.");
      const contactId = json.results?.[0]?.contactId;
      if (contactId) setSubmission((s) => ({ ...s, contact_id: contactId }));
      else router.refresh();
      flash(target === "contact" ? "Contact created." : target === "lead" ? "Converted to a lead." : "Added to the pipeline.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Permanently delete this submission from ${name}? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/contact-submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submission.id }),
      });
      if (!res.ok) throw new Error("Couldn't delete it.");
      router.push(LIST_HREF);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-5">
      {/* ── Action bar ─────────────────────────────────────────── */}
      <div className="sticky top-14 z-20 -mx-5 mb-5 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={LIST_HREF}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Contact Form Submissions
          </Link>

          <div className="flex items-center gap-2">
            {at >= 0 && siblings.length > 1 && (
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                {at + 1} of {siblings.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => go(prevId)}
              disabled={!prevId}
              title={prevId ? "Previous submission (k)" : "This is the newest submission"}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
            </button>
            <button
              type="button"
              onClick={() => go(nextId)}
              disabled={!nextId}
              title={nextId ? "Next submission (j)" : "This is the oldest submission"}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="hidden sm:inline">Next Form Submission</span> <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {(error || toast) && (
        <div
          role="status"
          className={cn(
            "mb-4 rounded-lg border px-3 py-2 text-sm",
            error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-accent/40 bg-accent/10 text-accent",
          )}
        >
          {error ?? toast}
        </div>
      )}

      {/* ── Identity header ────────────────────────────────────── */}
      <header className="mb-5 rounded-xl border border-border bg-card p-5">
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
            {submissionInitials(submission)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold leading-tight">{name}</h1>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-medium", statusTone(submission.status))}>
                {statusLabel(submission.status)}
              </span>
              {submission.contact_id && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3" /> Contact linked
                </span>
              )}
            </div>

            <p className="mt-1 text-base font-medium text-foreground">{submission.subject || "No subject"}</p>

            <div className="mt-2 flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <CopyableLink href={`mailto:${submission.email}`} icon={Mail} value={submission.email} copy={submission.email} />
              {submission.phone && (
                <CopyableLink
                  href={tel ? `tel:${tel}` : undefined}
                  icon={Phone}
                  value={displayPhone(submission.phone)}
                  copy={submission.phone}
                />
              )}
              {address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition hover:text-accent"
                >
                  <MapPin className="h-3.5 w-3.5" /> {address}
                </a>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Submitted {new Date(submission.submitted_at).toLocaleString("en-US", {
                weekday: "short", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              })}
              {submission.how_heard ? ` · Heard about us via ${submission.how_heard}` : ""}
            </p>
          </div>

          <QuickActions submission={submission} onFlash={flash} onError={setError} onReply={setReplyChannel} />
        </div>
      </header>

      {/* ── Body: message + reply on the left, everything else on the right ── */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <ClipboardList className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Message</h2>
            </div>
            {/* The whole message, however long. This is the bug that started
                all of this: the modal clipped both ends of a long enquiry. */}
            <div className="whitespace-pre-wrap break-words px-5 py-4 text-[15px] leading-relaxed">
              {submission.message || <span className="text-muted-foreground">No message was included.</span>}
            </div>
          </section>

          <ReplyBox submission={submission} channel={replyChannel} onChannel={setReplyChannel} onFlash={flash} onError={setError} />

          <ThreadHistory thread={thread} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Panel icon={ClipboardList} title="Submission Details">
            <dl className="space-y-2.5">
              <Detail label="First name" value={submission.first_name} />
              <Detail label="Last name" value={submission.last_name} />
              <Detail label="Email" value={submission.email} />
              <Detail label="Phone" value={submission.phone ? displayPhone(submission.phone) : "—"} />
              <Detail label="How they heard" value={submission.how_heard || "—"} />
              <Detail label="Subject" value={submission.subject || "—"} />
              <Detail label="Project address" value={address || "—"} />
              <Detail label="Project budget" value={budget || "—"} />
            </dl>
          </Panel>

          {submission.project_status?.length > 0 && (
            <Panel icon={Workflow} title="Project Status">
              <div className="flex flex-wrap gap-1.5">
                {submission.project_status.map((s) => (
                  <span key={s} className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                    {s}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          <Panel icon={Workflow} title="Convert">
            {!canConvert ? (
              <p className="text-xs text-muted-foreground">Your role can&apos;t convert submissions.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <SmallBtn icon={UserRound} disabled={busy || !!submission.contact_id} onClick={() => void convert("contact")}>
                  {submission.contact_id ? "Contact linked" : "Add Contact"}
                </SmallBtn>
                <SmallBtn icon={BriefcaseBusiness} disabled={busy} onClick={() => void convert("lead")}>Convert to Lead</SmallBtn>
                <SmallBtn icon={Workflow} disabled={busy} onClick={() => void convert("deal")}>Add to Pipeline</SmallBtn>
              </div>
            )}
          </Panel>

          <AssignPanel submission={submission} />

          <Panel icon={Check} title="Mark As">
            <div className="flex flex-wrap gap-1.5">
              {SUBMISSION_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={submission.status === s}
                  onClick={() => void setStatus(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    submission.status === s
                      ? "cursor-default border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
                  )}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </Panel>

          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete submission
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border px-1">J</kbd> next ·{" "}
            <kbd className="rounded border border-border px-1">K</kbd> previous ·{" "}
            <kbd className="rounded border border-border px-1">Esc</kbd> back
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ── Quick actions ──────────────────────────────────────────────── */

/**
 * Reply, text, call — plus a hand-off to Gmail or Outlook.
 *
 * The in-app reply is the default because it logs against the contact; the
 * external links are there for when someone wants the reply in their own sent
 * folder with their own signature.
 */
function QuickActions({
  submission, onFlash, onError, onReply,
}: {
  submission: ContactSubmission;
  onFlash: (m: string) => void;
  onError: (m: string | null) => void;
  onReply: (channel: "email" | "sms") => void;
}) {
  const [calling, setCalling] = React.useState(false);
  const tel = telHref(submission.phone);
  const links = composeLinks(submission.email, `Re: ${submission.subject || "Your enquiry"}`);

  async function call() {
    if (!tel) return;
    setCalling(true); onError(null);
    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "call", to: tel, contact_id: submission.contact_id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "The call didn't connect.");
      onFlash("Calling — your phone will ring first, then we connect them.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setCalling(false);
    }
  }

  // Put the composer in the right mode, then bring it into view and focus it.
  function reply(channel: "email" | "sms") {
    onReply(channel);
    const box = document.getElementById("reply-box");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => box?.querySelector("textarea")?.focus(), 350);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="accent" onClick={() => reply("email")}>
        <Send className="h-3.5 w-3.5" /> Reply
      </Button>
      <SmallBtn icon={MessageSquare} disabled={!tel} onClick={() => reply("sms")}>
        SMS
      </SmallBtn>
      <SmallBtn icon={calling ? Loader2 : Phone} disabled={!tel || calling} onClick={() => void call()}>
        {calling ? "Calling…" : "Call"}
      </SmallBtn>
      <a
        href={links.gmail}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent"
      >
        <Mail className="h-3.5 w-3.5" /> Gmail <ExternalLink className="h-3 w-3 opacity-50" />
      </a>
      <a
        href={links.outlook}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent"
      >
        <Mail className="h-3.5 w-3.5" /> Outlook <ExternalLink className="h-3 w-3 opacity-50" />
      </a>
    </div>
  );
}

/* ── Reply ──────────────────────────────────────────────────────── */

function ReplyBox({
  submission, channel, onChannel, onFlash, onError,
}: {
  submission: ContactSubmission;
  channel: "email" | "sms";
  onChannel: (c: "email" | "sms") => void;
  onFlash: (m: string) => void;
  onError: (m: string | null) => void;
}) {
  const [subject, setSubject] = React.useState(`Re: ${submission.subject || "Your enquiry"}`);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const tel = telHref(submission.phone);
  const canSend = channel === "email" ? !!submission.email && body.trim().length > 0 : !!tel && body.trim().length > 0;

  async function send() {
    setSending(true); onError(null);
    try {
      const payload = channel === "email"
        ? { channel: "email", to: submission.email, subject, body: textToHtml(body), contact_id: submission.contact_id }
        : { channel: "sms", to: tel, body: body.trim(), contact_id: submission.contact_id };
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "That didn't send.");
      setBody("");
      setSent(true);
      onFlash(channel === "email" ? "Email sent and logged." : "Text sent and logged.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="reply-box" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Reply</h2>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(["email", "sms"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChannel(c); setSent(false); }}
              disabled={c === "sms" && !tel}
              title={c === "sms" && !tel ? "No phone number on this submission" : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40",
                channel === c ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "email" ? "Email" : "Text"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="text-xs text-muted-foreground">
          To <span className="font-medium text-foreground">
            {channel === "email" ? submission.email : displayPhone(submission.phone)}
          </span>
        </div>

        {channel === "email" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
        )}

        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setSent(false); }}
          rows={channel === "email" ? 7 : 4}
          placeholder={channel === "email" ? `Hi ${submission.first_name?.trim() || "there"},` : "Keep it short — this goes out as a text message."}
          className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-accent"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {channel === "email"
              ? "Sends from Constructed Matter, Inc. and is logged against this contact."
              : `${body.length} characters · logged against this contact.`}
          </p>
          <div className="flex items-center gap-2">
            {sent && <span className="inline-flex items-center gap-1 text-xs font-medium text-accent"><Check className="h-3.5 w-3.5" /> Sent</span>}
            <Button size="sm" variant="accent" disabled={!canSend || sending} onClick={() => void send()}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Sending…" : channel === "email" ? "Send email" : "Send text"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Plain text a person typed into a textarea, as safe, readable email HTML. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3F3F46;">`
    + escaped.replace(/\n/g, "<br/>")
    + `<br/><br/><div style="border-top:1px solid #E7E5E4;padding-top:12px;font-size:13px;color:#8A8A8A;">`
    + `<strong style="color:#111111;">Constructed Matter, Inc.</strong><br/>`
    + `7314 E Osborn Dr Suite A · Scottsdale, AZ 85251<br/>`
    + `(480) 628-4458 · info@constructedmatter.com<br/>ROC License KB1 - 343120`
    + `</div></div>`;
}

/* ── Prior conversation ─────────────────────────────────────────── */

function ThreadHistory({ thread }: { thread: ThreadMessage[] }) {
  if (thread.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageSquare className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Earlier with this person</h2>
        <span className="text-xs text-muted-foreground">{thread.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {thread.map((m) => (
          <li key={m.id} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn(
                "rounded-full border px-2 py-0.5 font-medium",
                m.direction === "inbound" ? "border-info/40 text-info" : "border-border",
              )}>
                {m.direction === "inbound" ? "From them" : "From us"}
              </span>
              <span className="uppercase tracking-wide">{m.channel}</span>
              <span>{new Date(m.sent_at ?? m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              {m.status && m.status !== "sent" && m.status !== "delivered" && (
                <span className="text-destructive">{m.status}</span>
              )}
            </div>
            {m.subject && <p className="mt-1 text-sm font-medium">{m.subject}</p>}
            {m.body && <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{stripHtml(m.body)}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Logged email bodies are HTML; the history only needs the gist. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/* ── Assign / route ─────────────────────────────────────────────── */

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
    <Panel icon={Tag} title="Assign / Route">
      <div className="mb-3">
        <div className="mb-1.5 text-xs text-muted-foreground">
          Tag {submission.first_name || "this contact"} as:
        </div>
        {!contactId ? (
          <p className="text-xs text-muted-foreground">
            No linked contact record yet — use <strong>Add Contact</strong> above first.
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
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-60",
                    active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
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

      <div>
        <div className="mb-1.5 text-xs text-muted-foreground">Open in:</div>
        <div className="flex flex-wrap gap-1.5">
          {routes.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ── Small shared pieces ────────────────────────────────────────── */

function Panel({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-sm">{value}</dd>
    </div>
  );
}

function SmallBtn({
  children, icon: Icon, onClick, disabled,
}: {
  children: React.ReactNode; icon: React.ElementType; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

/** A contact handle you can click to use, or click once more to copy. */
function CopyableLink({
  href, icon: Icon, value, copy,
}: {
  href?: string; icon: React.ElementType; value: string; copy: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <a href={href} className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-accent">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate sm:break-all sm:whitespace-normal">{value}</span>
      </a>
      <button
        type="button"
        aria-label={`Copy ${value}`}
        title={copied ? "Copied" : "Copy"}
        onClick={() => {
          void navigator.clipboard?.writeText(copy).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }).catch(() => { /* clipboard blocked; the text is still selectable */ });
        }}
        className="rounded p-0.5 text-muted-foreground/60 transition hover:text-accent"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
