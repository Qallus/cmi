"use client";

// "Executive Summary" on a Job or Pre-Con page. Bolt reads the whole record
// and drafts a CMI-branded summary for the TEAM (candid: budget, risks, owners)
// or the CLIENT (client-safe only). Staff edit it, preview the branded
// document, then email it, post it to the client portal (Jobs), or save a PDF.
import * as React from "react";
import {
  Check, Copy, Download, Eye, FileText, Loader2, Mail, Pencil, Plus, RefreshCw, Send, Sparkles, Trash2, Users, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { Modal } from "@/components/punch/shared";
import { cn } from "@/lib/utils";
import { htmlToText, sanitizeHtml } from "@/lib/notes/html";
import { summaryDocumentHtml } from "@/lib/exec-summary/render";

type Target = "job" | "precon";
type Audience = "team" | "client";
type Fact = { label: string; value: string };
type Draft = { headline: string; facts: Fact[]; body_html: string; project: { name: string; number: string | null; kind: "Job" | "Pre-Con" } };
type Person = { id: string; name: string; email: string | null; onRecord?: boolean };
type HistoryRow = { id: string; audience: Audience; headline: string; body_html: string; facts: Fact[]; sent_to: { name: string }[]; posted_to_portal: boolean; created_by_name: string | null; sent_at: string | null; created_at: string };

async function json<T>(res: Response): Promise<T> {
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${res.status}).`);
  return j as T;
}

export function ExecSummaryButton({ target, id, name, className }: { target: Target; id: string; name: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5 text-accent" /> Executive Summary
      </Button>
      {open && <ExecSummaryDialog target={target} id={id} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExecSummaryDialog({ target, id, name, onClose }: { target: Target; id: string; name: string; onClose: () => void }) {
  const [audience, setAudience] = React.useState<Audience>("team");
  const [guidance, setGuidance] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [version, setVersion] = React.useState(0);   // remounts the editor on a new draft
  const [tab, setTab] = React.useState<"edit" | "preview">("preview");
  const [busy, setBusy] = React.useState<null | "generate" | "send">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[] | null>(null);
  const [people, setPeople] = React.useState<{ staff: Person[]; contacts: Person[]; canSendToClient: boolean } | null>(null);
  const [sending, setSending] = React.useState(false);
  const [staffIds, setStaffIds] = React.useState<Set<string>>(new Set());
  const [contactIds, setContactIds] = React.useState<Set<string>>(new Set());
  const [extra, setExtra] = React.useState("");
  const [note, setNote] = React.useState("");
  const [postToPortal, setPostToPortal] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const q = `target=${target}&id=${id}`;
  React.useEffect(() => {
    fetch(`/api/exec-summary?${q}`).then((r) => json<HistoryRow[]>(r)).then(setHistory).catch(() => setHistory([]));
    fetch(`/api/exec-summary/recipients?${q}`).then((r) => json<typeof people>(r)).then((p) => {
      setPeople(p);
      if (p) {
        setStaffIds(new Set(p.staff.filter((s) => s.onRecord && s.email).map((s) => s.id)));
        setContactIds(new Set(p.contacts.filter((c) => c.email).map((c) => c.id)));
      }
    }).catch(() => setPeople({ staff: [], contacts: [], canSendToClient: false }));
  }, [q]);

  async function generate() {
    setBusy("generate"); setError(null); setResult(null);
    try {
      const d = await json<Draft>(await fetch("/api/exec-summary/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, id, audience, guidance }),
      }));
      setDraft(d); setVersion((v) => v + 1); setTab("preview"); setSending(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function openPast(h: HistoryRow) {
    setAudience(h.audience);
    setDraft({ headline: h.headline, facts: h.facts ?? [], body_html: h.body_html, project: { name, number: null, kind: target === "job" ? "Job" : "Pre-Con" } });
    setVersion((v) => v + 1); setTab("preview"); setResult(null);
  }

  const doc = React.useMemo(() => draft && summaryDocumentHtml({
    audience, kind: draft.project.kind, projectName: draft.project.name, projectNumber: draft.project.number,
    headline: draft.headline, facts: draft.facts.filter((f) => f.label.trim() && f.value.trim()),
    bodyHtml: sanitizeHtml(draft.body_html), preparedBy: null,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    note: sending ? note : null,
  }), [draft, audience, note, sending]);

  function downloadPdf() {
    if (!draft) return;
    const w = window.open("", "_blank");
    if (!w) { setError("Allow pop-ups to save the PDF."); return; }
    w.document.write(summaryDocumentHtml({
      audience, kind: draft.project.kind, projectName: draft.project.name, projectNumber: draft.project.number,
      headline: draft.headline, facts: draft.facts.filter((f) => f.label.trim() && f.value.trim()), bodyHtml: sanitizeHtml(draft.body_html),
      preparedBy: null, dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
      appUrl: window.location.origin,
    }, { print: true }));
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  async function copyText() {
    if (!draft) return;
    const facts = draft.facts.map((f) => `${f.label}: ${f.value}`).join("\n");
    const body = draft.body_html.replace(/<\/(h2|p|li)>/g, "\n").replace(/<li>/g, "• ");
    await navigator.clipboard.writeText(`${draft.headline}\n\n${facts}\n\n${htmlToText(body.replace(/\n/g, "§")).replace(/§/g, "\n")}`.trim());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function send() {
    if (!draft) return;
    setBusy("send"); setError(null);
    try {
      const r = await json<{ sent: string[]; skipped: { name: string; reason: string }[]; posted: boolean }>(await fetch("/api/exec-summary/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target, id, audience, headline: draft.headline, facts: draft.facts.filter((f) => f.label.trim() && f.value.trim()),
          body_html: sanitizeHtml(draft.body_html), note,
          staff_ids: [...staffIds], contact_ids: audience === "client" ? [...contactIds] : [],
          extra_emails: audience === "client" ? extra.split(/[,\s;]+/).filter(Boolean) : [],
          post_to_portal: audience === "client" && target === "job" && postToPortal,
        }),
      }));
      const parts = [
        r.sent.length ? `Emailed ${r.sent.join(", ")}` : null,
        r.posted ? "posted to the client portal" : null,
        r.skipped.length ? `skipped ${r.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : null,
      ].filter(Boolean);
      setResult(parts.join("; ") + ".");
      setSending(false);
      fetch(`/api/exec-summary?${q}`).then((x) => json<HistoryRow[]>(x)).then(setHistory).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const recipients = staffIds.size + (audience === "client" ? contactIds.size + extra.split(/[,\s;]+/).filter(Boolean).length : 0);

  return (
    <Modal title={`Executive Summary · ${name}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Audience + generate */}
        <div className="grid grid-cols-2 gap-2">
          {([["team", Users, "Team", "Internal — budget, risks, owners and next steps"], ["client", UserRound, "Client", "Client-safe — progress, what's next, what we need"]] as const).map(([key, Icon, label, hint]) => (
            <button key={key} type="button" onClick={() => { setAudience(key); if (draft) setResult(null); }} disabled={!!busy}
              className={cn("rounded-lg border p-3 text-left transition", audience === key ? "border-accent bg-accent/10" : "border-border hover:bg-muted")}>
              <div className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-4 w-4" /> {label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>
            </button>
          ))}
        </div>
        <textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={2} disabled={!!busy}
          placeholder="Anything Bolt should emphasize? (optional) e.g. “focus on the cabinet delay and the revised finish date”"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="accent" onClick={() => void generate()} disabled={!!busy}>
            {busy === "generate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : draft ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy === "generate" ? "Bolt is reading the whole record…" : draft ? `Regenerate for ${audience === "team" ? "Team" : "Client"}` : `Generate ${audience === "team" ? "Team" : "Client"} summary`}
          </Button>
          {audience === "client" && <span className="text-[11px] text-muted-foreground">Client summaries leave out internal notes, costs, margins and vendor details.</span>}
        </div>
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {result && <div className="flex items-start gap-1.5 rounded bg-success/10 px-3 py-2 text-sm text-success"><Check className="mt-0.5 h-4 w-4 shrink-0" />{result}</div>}

        {/* Review */}
        {draft && (
          <div className="space-y-3 rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex overflow-hidden rounded-md border border-border">
                {([["preview", Eye, "Preview"], ["edit", Pencil, "Edit"]] as const).map(([k, Icon, label]) => (
                  <button key={k} type="button" onClick={() => setTab(k)}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium", tab === k ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => void copyText()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy</Button>
                <Button size="sm" variant="ghost" onClick={downloadPdf}><Download className="h-3.5 w-3.5" /> PDF</Button>
                <Button size="sm" variant="accent" onClick={() => { setSending(true); setResult(null); }} disabled={sending}><Send className="h-3.5 w-3.5" /> Send…</Button>
              </div>
            </div>

            {tab === "preview" && doc && (
              <iframe title="Executive summary preview" srcDoc={doc} sandbox="" className="h-[60vh] w-full rounded-b-lg bg-[#F4F4F4]" />
            )}

            {tab === "edit" && (
              <div className="space-y-3 px-3 pb-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Headline</span>
                  <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-accent" />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Key facts</span>
                  {draft.facts.map((f, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={f.label} placeholder="Label" onChange={(e) => setDraft({ ...draft, facts: draft.facts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                        className="h-9 w-2/5 rounded-md border border-border bg-background px-2 text-xs uppercase tracking-wide outline-none focus:border-accent" />
                      <input value={f.value} placeholder="Value" onChange={(e) => setDraft({ ...draft, facts: draft.facts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                        className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
                      <button type="button" aria-label="Remove fact" onClick={() => setDraft({ ...draft, facts: draft.facts.filter((_, j) => j !== i) })}
                        className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  {draft.facts.length < 6 && (
                    <button type="button" onClick={() => setDraft({ ...draft, facts: [...draft.facts, { label: "", value: "" }] })}
                      className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="h-3 w-3" /> Add fact</button>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Summary</span>
                  <RichTextEditor key={version} value={draft.body_html} onChange={(v) => setDraft((d) => (d ? { ...d, body_html: v } : d))} />
                </div>
              </div>
            )}

            {/* Send panel */}
            {sending && (
              <div className="space-y-3 border-t border-border px-3 py-3">
                <div className="flex items-center gap-1.5 text-sm font-medium"><Mail className="h-4 w-4" /> Send the {audience === "team" ? "internal team" : "client"} summary</div>
                {!people && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people…</div>}
                {people && audience === "client" && !people.canSendToClient && (
                  <div className="rounded bg-warning/10 px-3 py-2 text-xs text-warning">Only Admins, Project Managers and Estimators can send summaries to clients. You can still download the PDF.</div>
                )}
                {people && audience === "client" && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Client</div>
                    {people.contacts.length === 0 && <div className="text-xs text-muted-foreground">No client contact on this record — add one, or type an address below.</div>}
                    {people.contacts.map((c) => (
                      <label key={c.id} className={cn("flex items-center gap-2 text-sm", !c.email && "opacity-50")}>
                        <input type="checkbox" className="h-4 w-4" disabled={!c.email} checked={contactIds.has(c.id)} onChange={() => toggle(setContactIds, c.id)} />
                        {c.name} <span className="text-xs text-muted-foreground">{c.email ?? "no email"}</span>
                      </label>
                    ))}
                    <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Other emails (comma-separated), e.g. a spouse or the designer"
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
                    {target === "job" && (
                      <label className="mt-1 flex items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={postToPortal} onChange={(e) => setPostToPortal(e.target.checked)} />
                        Also post it to the client portal as a project update
                      </label>
                    )}
                  </div>
                )}
                {people && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{audience === "client" ? "Copy CMI staff (optional)" : "CMI team"}</div>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {people.staff.map((s) => (
                        <label key={s.id} className={cn("flex items-center gap-2 text-sm", !s.email && "opacity-50")}>
                          <input type="checkbox" className="h-4 w-4" disabled={!s.email} checked={staffIds.has(s.id)} onChange={() => toggle(setStaffIds, s.id)} />
                          {s.name}{s.onRecord && <span className="rounded bg-accent/15 px-1.5 text-[10px] text-accent">on this {target === "job" ? "job" : "project"}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Personal note at the top (optional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSending(false)} disabled={busy === "send"}>Cancel</Button>
                  <Button size="sm" variant="accent" onClick={() => void send()}
                    disabled={busy === "send" || (audience === "client" && !people?.canSendToClient) || (!recipients && !(postToPortal && audience === "client" && target === "job"))}>
                    {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send{recipients ? ` to ${recipients}` : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history && history.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Sent before</div>
            {history.map((h) => (
              <button key={h.id} type="button" onClick={() => openPast(h)}
                className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.headline}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {h.audience === "team" ? "Team" : "Client"} · {new Date(h.sent_at ?? h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {h.created_by_name ? ` · ${h.created_by_name}` : ""}
                    {h.sent_to?.length ? ` · to ${h.sent_to.map((s) => s.name).join(", ")}` : ""}
                    {h.posted_to_portal ? " · posted to portal" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
