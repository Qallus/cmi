"use client";

// Email / SMS compose modal. Moved out of the Communications page so a Job can
// open the same composer with its own contacts: pass `recipients` and the To
// field gains a "this job's contacts" picker, and sends are logged against the
// contact and the job.
import * as React from "react";
import { ChevronDown, Eye, LayoutTemplate, Mail, MessageSquare, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/communications/types";
import { DynamicFieldsBar } from "@/components/ui/dynamic-fields-bar";
import { EmailPreview } from "@/components/email-builder/email-preview";
import { SidePanel } from "@/components/ui/side-panel";
import { RecipientPicker } from "./recipient-picker";

export type ComposeChannel = "email" | "sms";

/** A person the composer can address (a job's clients, subs and team). */
export type ComposeRecipient = {
  key: string;
  contactId: string | null;
  name: string;
  /** "Client", "Sub / Vendor", "Team"… */
  role: string;
  email: string | null;
  phone: string | null;
};

export type ComposeInit = { channel: ComposeChannel; to?: string; subject?: string; body?: string };

type TemplateRow = { id: string; name: string; subject: string; html?: string; status?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

export function ComposeDialog({ init, recipients, jobId, onClose, onSent, onRecipientSaved, variant = "modal" }: {
  init: ComposeInit;
  recipients?: ComposeRecipient[];
  /** A phone / email typed in the picker was saved to that contact. */
  onRecipientSaved?: (who: ComposeRecipient, address: string) => void;
  /** "panel" slides out from the right (used inside Jobs). */
  variant?: "modal" | "panel";
  /** Tags every message sent from here with the job. */
  jobId?: string | null;
  onClose: () => void;
  onSent?: (sent: Message[]) => void;
}) {
  const [draft, setDraft] = React.useState({ channel: init.channel, to: init.to ?? "", subject: init.subject ?? "", body: init.body ?? "" });
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [recipientTags, setRecipientTags] = React.useState<string[]>([]);
  const [recipientInput, setRecipientInput] = React.useState("");
  const [composeTemplates, setComposeTemplates] = React.useState<TemplateRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<{ id: string; name: string; subject: string; html: string } | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const templateMenuRef = React.useRef<HTMLDivElement>(null);
  const bodyTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const loadTemplates = React.useCallback(() => {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((data: { templates?: TemplateRow[] }) => setComposeTemplates((data.templates ?? []).filter((t) => t.status === "active")))
      .catch(() => {});
  }, []);

  const applyTemplate = React.useCallback((id: string) => {
    setShowTemplateMenu(false);
    setLoadingTemplate(true);
    fetch(`/api/admin/email-templates/${id}`)
      .then((r) => r.json() as Promise<{ template: { id: string; name: string; subject: string; html: string } }>)
      .then((data) => {
        setSelectedTemplate({ id: data.template.id, name: data.template.name, subject: data.template.subject, html: data.template.html ?? "" });
        setDraft((d) => ({ ...d, subject: data.template.subject || d.subject }));
        setShowTemplatePreview(true);
      })
      .catch(() => setSendError("Failed to load template."))
      .finally(() => setLoadingTemplate(false));
  }, []);

  React.useEffect(() => {
    if (init.channel === "email") loadTemplates();
  }, [init.channel, loadTemplates]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) setShowTemplateMenu(false);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && variant === "modal") onClose(); };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", handleClick); window.removeEventListener("keydown", onKey); };
  }, [onClose, variant]);

  // Addresses chosen in the picker this session (including ones just typed in
  // for a contact), so each send is logged against the right contact.
  const [picked, setPicked] = React.useState<Record<string, string | null>>({});

  // Which contact an address belongs to, so each send is logged against them.
  const contactFor = React.useCallback((address: string): string | null => {
    const a = address.trim().toLowerCase();
    if (a in picked) return picked[a];
    if (!recipients?.length) return null;
    const hit = recipients.find((r) => (r.email && r.email.toLowerCase() === a) || (r.phone && digits(r.phone) && digits(r.phone) === digits(a)));
    return hit?.contactId ?? null;
  }, [recipients, picked]);

  function addRecipient(address: string, who: ComposeRecipient | null) {
    setPicked((m) => ({ ...m, [address.trim().toLowerCase()]: who?.contactId ?? null }));
    if (draft.channel === "email") {
      // Promote a typed address to a tag so the picked one is added alongside it.
      setRecipientTags((prev) => Array.from(new Set([...prev, ...(draft.to.trim() && EMAIL_RE.test(draft.to.trim()) ? [draft.to.trim().toLowerCase()] : []), address.toLowerCase()])));
      setDraft((d) => ({ ...d, to: "" }));
    } else {
      setDraft((d) => ({ ...d, to: address }));
    }
  }

  function insertIntoBody(token: string) {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft((d) => ({ ...d, body: next }));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }

  function addRecipientTag(raw = recipientInput) {
    const emails = raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e));
    if (!emails.length) { setRecipientInput(""); return; }
    setRecipientTags((prev) => Array.from(new Set([...prev, ...emails])));
    setRecipientInput("");
  }

  async function send() {
    const body = selectedTemplate ? selectedTemplate.html : draft.body;
    const pendingInput = recipientInput.trim();
    const allEmails = Array.from(new Set([
      ...recipientTags,
      ...(pendingInput && EMAIL_RE.test(pendingInput) ? [pendingInput] : []),
      ...(draft.to.trim() && !recipientTags.length && !pendingInput ? [draft.to.trim()] : []),
    ]));
    if (allEmails.length === 0 && !draft.to.trim()) { setSendError("Recipient is required."); return; }
    const targets = allEmails.length > 0 ? allEmails : [draft.to.trim()];
    if (draft.channel === "email" && !draft.subject) { setSendError("Subject is required for email."); return; }
    if (!body) { setSendError("Message body is required."); return; }
    setSending(true); setSendError(null);
    try {
      const results = await Promise.all(
        targets.map((to) => {
          const contactId = contactFor(to);
          return fetch("/api/communications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, to, body, ...(contactId ? { contact_id: contactId } : {}), ...(jobId ? { job_id: jobId } : {}) }),
          }).then((r) => r.json() as Promise<Message & { error?: string }>);
        }),
      );
      const sent = results.filter((r) => r.id && !r.error);
      if (sent.length === 0) throw new Error((results[0] as { error?: string }).error ?? "Send failed.");
      onSent?.(sent);
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally { setSending(false); }
  }

  const title = draft.channel === "email" ? "Compose Email" : "Send SMS";
  const channelToggle = (
            <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
              <button type="button"
                onClick={() => { setDraft((d) => ({ ...d, channel: "email" })); if (!composeTemplates.length) loadTemplates(); }}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 transition", draft.channel === "email" ? "bg-accent/15 text-accent" : "text-muted-foreground")}>
                <Mail className="h-3 w-3" /> Email
              </button>
              <button type="button" onClick={() => setDraft((d) => ({ ...d, channel: "sms" }))}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 transition", draft.channel === "sms" ? "bg-accent/15 text-accent" : "text-muted-foreground")}>
                <MessageSquare className="h-3 w-3" /> SMS
              </button>
            </div>
  );
  const body = (
        <div className="space-y-3">
          {sendError && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{sendError}</div>}

          {recipients && (
            <RecipientPicker
              key={draft.channel}
              recipients={recipients}
              kind={draft.channel === "email" ? "email" : "phone"}
              label="This job's contacts"
              onUse={addRecipient}
              onSaved={onRecipientSaved}
            />
          )}

          {/* To: multi-recipient tag input */}
          <CF label={`To${recipientTags.length > 1 ? ` (${recipientTags.length} recipients)` : ""}`}>
            <div className="min-h-[36px] w-full rounded-md border border-border bg-background px-2.5 py-1.5 focus-within:border-accent">
              <div className="flex flex-wrap items-center gap-1.5">
                {recipientTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {tag}
                    <button type="button" onClick={() => setRecipientTags((prev) => prev.filter((t) => t !== tag))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={recipientTags.length > 0 ? "Add more..." : draft.channel === "email" ? "name@example.com" : "+1 (602) 555-0100"}
                  value={recipientTags.length > 0 ? recipientInput : draft.to}
                  onChange={(e) => (recipientTags.length > 0 ? setRecipientInput(e.target.value) : setDraft((d) => ({ ...d, to: e.target.value })))}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === "," || e.key === " ") && draft.channel === "email") {
                      e.preventDefault();
                      const val = recipientTags.length > 0 ? recipientInput : draft.to;
                      if (val.trim()) { addRecipientTag(val); if (recipientTags.length === 0) setDraft((d) => ({ ...d, to: "" })); }
                    }
                  }}
                  onBlur={() => {
                    const val = recipientTags.length > 0 ? recipientInput : draft.to;
                    if (val.trim() && draft.channel === "email" && EMAIL_RE.test(val.trim())) {
                      addRecipientTag(val);
                      if (recipientTags.length === 0) setDraft((d) => ({ ...d, to: "" }));
                    }
                  }}
                />
              </div>
            </div>
            {draft.channel === "email" && !recipients && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Add group:</span>
                {([
                  { label: "All Contacts", value: "contacts" },
                  { label: "All Staff", value: "staff" },
                ] as const).map(({ label, value }) => (
                  <button key={value} type="button"
                    onClick={() => {
                      const tag = `group:${value}`;
                      setRecipientTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
                    }}
                    className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
                      recipientTags.includes(`group:${value}`) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40")}>
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
                <input className={cn(iCls, "flex-1")} placeholder="Email subject..." value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
                {composeTemplates.length > 0 && (
                  <div className="relative shrink-0" ref={templateMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowTemplateMenu((v) => !v)}
                      className={cn("flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition",
                        selectedTemplate ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground")}
                    >
                      <LayoutTemplate className="h-3 w-3" />
                      {selectedTemplate ? selectedTemplate.name : "Template"}
                      <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplateMenu && "rotate-180")} />
                    </button>
                    {showTemplateMenu && (
                      <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                        {selectedTemplate && (
                          <button type="button" onClick={() => { setSelectedTemplate(null); setShowTemplateMenu(false); setDraft((d) => ({ ...d, subject: "", body: "" })); }}
                            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                            <X className="h-3 w-3" /> Clear template
                          </button>
                        )}
                        <div className="max-h-48 overflow-y-auto py-1">
                          {composeTemplates.map((t) => (
                            <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
                              className={cn("flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-xs transition hover:bg-muted", selectedTemplate?.id === t.id && "bg-accent/5 text-accent")}>
                              <span className="font-semibold">{t.name}</span>
                              {t.subject && <span className="truncate text-muted-foreground">{t.subject}</span>}
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
              <div className="flex h-16 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">Loading template...</div>
            ) : selectedTemplate ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Using: <strong className="text-foreground">{selectedTemplate.name}</strong></span>
                  <button type="button" onClick={() => setShowTemplatePreview((v) => !v)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                    <Eye className="h-3 w-3" /> {showTemplatePreview ? "Hide" : "Show"} preview
                  </button>
                </div>
                {showTemplatePreview && <EmailPreview html={selectedTemplate.html} inlineHeight={260} />}
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
            <span className="text-[11px] text-muted-foreground">{recipientTags.length > 1 ? `Sending to ${recipientTags.length} recipients` : ""}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void send()} disabled={sending}>
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending..." : recipientTags.length > 1 ? `Send to ${recipientTags.length}` : "Send"}
              </Button>
            </div>
          </div>
        </div>
  );

  if (variant === "panel") {
    return (
      <SidePanel title={title} subtitle={recipients ? "Pick from this job's people or enter an address" : undefined} onClose={onClose} wide>
        <div className="mb-4">{channelToggle}</div>
        {body}
      </SidePanel>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <div className="flex items-center gap-3">
            {channelToggle}
            <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-5">{body}</div>
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
