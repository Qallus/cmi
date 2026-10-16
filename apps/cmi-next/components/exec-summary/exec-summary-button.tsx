"use client";

// "Executive Summary" on a Job or Pre-Con page. Bolt reads the whole record
// and drafts a CMI-branded summary for the TEAM (candid: budget, risks, owners)
// or the CLIENT (client-safe only). Staff edit it, preview the branded
// document, then email it, post it to the client portal (Jobs), or save a PDF.
import * as React from "react";
import {
  ArrowLeft, Check, Copy, Download, Eye, FileText, Loader2, Mail, MessageSquare, Pencil, Plus, RefreshCw, Send, Sparkles, Trash2, Users, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { Modal } from "@/components/punch/shared";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import { htmlToText, sanitizeHtml } from "@/lib/notes/html";
import { summaryDocumentHtml } from "@/lib/exec-summary/render";

type Target = "job" | "precon";
type Audience = "team" | "client";
type Fact = { label: string; value: string };
type Coming = { item: string; when: string | null };
type Photo = { url: string; caption: string | null; date?: string | null; clientVisible?: boolean; include: boolean };
type Draft = {
  headline: string; opening: string; facts: Fact[]; completed: string[]; coming_soon: Coming[];
  photos: Photo[]; firstNames: string[]; body_html: string;
  project: { name: string; number: string | null; kind: "Job" | "Pre-Con" };
};
type Person = { id: string; name: string; email: string | null; phone?: string | null; onRecord?: boolean };
type HistoryRow = { id: string; audience: Audience; headline: string; body_html: string; facts: Fact[]; content?: { opening?: string; completed?: string[]; coming_soon?: Coming[]; photos?: { url: string; caption: string | null }[] }; sent_to: { name: string }[]; posted_to_portal: boolean; created_by_name: string | null; sent_at: string | null; created_at: string };

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

// `asPanel` opens it as a right-hand slide-out (the job top bar) instead of a modal.
export function ExecSummaryDialog({ target, id, name, onClose, asPanel = false }: { target: Target; id: string; name: string; onClose: () => void; asPanel?: boolean }) {
  const Shell = asPanel ? SidePanel : Modal;
  const [audience, setAudience] = React.useState<Audience>("team");
  const [guidance, setGuidance] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [version, setVersion] = React.useState(0);   // remounts the editor on a new draft
  const [tab, setTab] = React.useState<"edit" | "preview">("preview");
  const [busy, setBusy] = React.useState<null | "generate" | "send">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[] | null>(null);
  const [people, setPeople] = React.useState<{ staff: Person[]; contacts: Person[]; canSendToClient: boolean } | null>(null);
  // Which send form is open: the full document by email, or a link to it by text.
  const [sendVia, setSendVia] = React.useState<null | "email" | "sms">(null);
  const [extraPhones, setExtraPhones] = React.useState("");
  const [link, setLink] = React.useState<string | null>(null);
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
      setDraft(d); setVersion((v) => v + 1); setTab("preview"); setSendVia(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function openPast(h: HistoryRow) {
    setAudience(h.audience);
    setDraft({
      headline: h.headline, opening: h.content?.opening ?? "", facts: h.facts ?? [],
      completed: h.content?.completed ?? [], coming_soon: h.content?.coming_soon ?? [],
      photos: (h.content?.photos ?? []).map((p) => ({ ...p, include: true })), firstNames: [],
      body_html: h.body_html, project: { name, number: null, kind: target === "job" ? "Job" : "Pre-Con" },
    });
    setVersion((v) => v + 1); setTab("preview"); setResult(null);
  }

  // The preview greets the first client (or "team"); each email is personalized on send.
  const docProps = React.useCallback((d: Draft) => ({
    audience, kind: d.project.kind, projectName: d.project.name, projectNumber: d.project.number,
    headline: d.headline, opening: d.opening,
    firstName: audience === "client" ? d.firstNames[0] ?? null : "team",
    facts: d.facts.filter((f) => f.label.trim() && f.value.trim()),
    completed: d.completed.map((c) => c.trim()).filter(Boolean),
    comingSoon: d.coming_soon.filter((c) => c.item.trim()),
    photos: d.photos.filter((p) => p.include).map((p) => ({ url: p.url, caption: p.caption })),
    bodyHtml: sanitizeHtml(d.body_html), preparedBy: null,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
  }), [audience]);
  const doc = React.useMemo(() => draft && summaryDocumentHtml({ ...docProps(draft), note: sendVia === "email" ? note : null }), [draft, docProps, note, sendVia]);

  // Open a send form. Clients are pre-ticked when they can be reached that way.
  function openSend(via: "email" | "sms") {
    setSendVia(via); setResult(null); setLink(null); setError(null);
    if (people) setContactIds(new Set(people.contacts.filter((c) => (via === "email" ? c.email : c.phone)).map((c) => c.id)));
  }

  function downloadPdf() {
    if (!draft) return;
    const w = window.open("", "_blank");
    if (!w) { setError("Allow pop-ups to save the PDF."); return; }
    w.document.write(summaryDocumentHtml(docProps(draft), { print: true }));
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  async function copyText() {
    if (!draft) return;
    const facts = draft.facts.map((f) => `${f.label}: ${f.value}`).join("\n");
    const body = draft.body_html.replace(/<\/(h2|p|li)>/g, "\n").replace(/<li>/g, "• ");
    const opening = draft.opening.replace(/\{\{\s*first_name\s*\}\}/gi, audience === "client" ? draft.firstNames[0] ?? "there" : "team");
    const done = draft.completed.length ? `Completed\n${draft.completed.map((c) => `✓ ${c}`).join("\n")}` : "";
    const next = draft.coming_soon.length ? `Coming Soon\n${draft.coming_soon.map((c) => `• ${c.item}${c.when ? ` — ${c.when}` : ""}`).join("\n")}` : "";
    await navigator.clipboard.writeText([draft.headline, opening, facts, done, next, htmlToText(body.replace(/\n/g, "§")).replace(/§/g, "\n")].filter(Boolean).join("\n\n").trim());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function send() {
    if (!draft) return;
    setBusy("send"); setError(null);
    try {
      const r = await json<{ sent: string[]; skipped: { name: string; reason: string }[]; posted: boolean; channel: "email" | "sms"; link: string | null }>(await fetch("/api/exec-summary/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target, id, audience, headline: draft.headline, opening: draft.opening,
          facts: draft.facts.filter((f) => f.label.trim() && f.value.trim()),
          completed: draft.completed.map((c) => c.trim()).filter(Boolean),
          coming_soon: draft.coming_soon.filter((c) => c.item.trim()),
          photos: draft.photos.filter((p) => p.include).map((p) => ({ url: p.url, caption: p.caption })),
          body_html: sanitizeHtml(draft.body_html), note,
          channel: sendVia ?? "email",
          staff_ids: sendVia === "email" ? [...staffIds] : [], contact_ids: audience === "client" ? [...contactIds] : [],
          extra_emails: audience === "client" && sendVia === "email" ? extra.split(/[,\s;]+/).filter(Boolean) : [],
          extra_phones: audience === "client" && sendVia === "sms" ? extraPhones.split(/[,;]+/).map((x) => x.trim()).filter(Boolean) : [],
          post_to_portal: audience === "client" && target === "job" && postToPortal,
        }),
      }));
      const parts = [
        r.sent.length ? `${r.channel === "sms" ? "Texted" : "Emailed"} ${r.sent.join(", ")}` : null,
        r.posted ? "posted to the client portal" : null,
        r.skipped.length ? `skipped ${r.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : null,
      ].filter(Boolean);
      setResult(parts.join("; ") + ".");
      setLink(r.link);
      setSendVia(null);
      fetch(`/api/exec-summary?${q}`).then((x) => json<HistoryRow[]>(x)).then(setHistory).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const recipients = sendVia === "sms"
    ? contactIds.size + extraPhones.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).length
    : staffIds.size + (audience === "client" ? contactIds.size + extra.split(/[,\s;]+/).filter(Boolean).length : 0);

  return (
    <Shell title={`Executive Summary · ${name}`} onClose={onClose} wide>
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
        {result && (
          <div className="rounded bg-success/10 px-3 py-2 text-sm text-success">
            <div className="flex items-start gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0" />{result}</div>
            {link && <div className="mt-1 pl-5 text-xs">Client link: <a href={link} target="_blank" rel="noreferrer" className="underline">{link}</a></div>}
          </div>
        )}

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
                {audience === "client" && (
                  <Button size="sm" variant="outline" onClick={() => openSend("sms")} disabled={sendVia === "sms"}><MessageSquare className="h-3.5 w-3.5" /> Send SMS</Button>
                )}
                <Button size="sm" variant="accent" onClick={() => openSend("email")} disabled={sendVia === "email"}><Mail className="h-3.5 w-3.5" /> Send Email</Button>
              </div>
            </div>

            {!sendVia && tab === "preview" && doc && (
              <iframe title="Executive summary preview" srcDoc={doc} sandbox="" className="h-[60vh] w-full rounded-b-lg bg-[#F4F4F4]" />
            )}

            {!sendVia && tab === "edit" && (
              <div className="space-y-3 px-3 pb-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Headline</span>
                  <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-accent" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Opening paragraph <span className="font-normal">— keep {"{{first_name}}"}; it becomes each reader&apos;s first name</span></span>
                  <textarea value={draft.opening} rows={6} onChange={(e) => setDraft({ ...draft, opening: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent" />
                </label>
                <ListEditor label="Completed" items={draft.completed} placeholder="Foundation inspection passed"
                  onChange={(completed) => setDraft({ ...draft, completed })} />
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Coming soon</span>
                  {draft.coming_soon.map((c, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={c.item} placeholder="Rough electrical" onChange={(e) => setDraft({ ...draft, coming_soon: draft.coming_soon.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)) })}
                        className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
                      <input value={c.when ?? ""} placeholder="Oct 22" onChange={(e) => setDraft({ ...draft, coming_soon: draft.coming_soon.map((x, j) => (j === i ? { ...x, when: e.target.value || null } : x)) })}
                        className="h-9 w-28 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
                      <button type="button" aria-label="Remove" onClick={() => setDraft({ ...draft, coming_soon: draft.coming_soon.filter((_, j) => j !== i) })}
                        className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDraft({ ...draft, coming_soon: [...draft.coming_soon, { item: "", when: null }] })}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="h-3 w-3" /> Add item</button>
                </div>
                {draft.photos.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Photos <span className="font-normal">— tick the ones to include{audience === "client" ? "; internal photos start unticked" : ""}</span></span>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {draft.photos.map((p, i) => (
                        <button key={p.url} type="button" onClick={() => setDraft({ ...draft, photos: draft.photos.map((x, j) => (j === i ? { ...x, include: !x.include } : x)) })}
                          className={cn("relative overflow-hidden rounded-md border-2", p.include ? "border-accent" : "border-transparent opacity-60")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.caption ?? "Project photo"} className="aspect-square w-full object-cover" />
                          <span className={cn("absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-white", p.include ? "bg-accent" : "bg-black/40")}>{p.include && <Check className="h-3 w-3" />}</span>
                          {audience === "client" && !p.clientVisible && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">internal</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  <span className="text-xs font-medium text-muted-foreground">More sections</span>
                  <RichTextEditor key={version} value={draft.body_html} onChange={(v) => setDraft((d) => (d ? { ...d, body_html: v } : d))} />
                </div>
              </div>
            )}

            {/* Send form (replaces the preview while open) */}
            {sendVia && (
              <div className="space-y-4 px-4 pb-4 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {sendVia === "email" ? <Mail className="h-4 w-4 text-accent" /> : <MessageSquare className="h-4 w-4 text-accent" />}
                      {sendVia === "email" ? "Send by email" : "Send by text message"}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {sendVia === "email"
                        ? `Each person gets the full ${audience === "team" ? "internal " : ""}summary as a branded email, greeted by first name.`
                        : "Each client gets a short text with a link to view or save this summary as a PDF, plus a link to their project portal."}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSendVia(null)} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to preview
                  </button>
                </div>

                {!people && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people…</div>}
                {people && audience === "client" && !people.canSendToClient && (
                  <div className="rounded bg-warning/10 px-3 py-2 text-xs text-warning">Only Admins, Project Managers and Estimators can send summaries to clients. You can still download the PDF.</div>
                )}

                {people && audience === "client" && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Client</div>
                    {people.contacts.length === 0 && <div className="text-xs text-muted-foreground">No client contact on this record. Add one, or type {sendVia === "email" ? "an address" : "a number"} below.</div>}
                    {people.contacts.map((c) => {
                      const reach = sendVia === "email" ? c.email : c.phone;
                      return (
                        <label key={c.id} className={cn("flex items-center gap-2 text-sm", !reach && "opacity-50")}>
                          <input type="checkbox" className="h-4 w-4" disabled={!reach} checked={contactIds.has(c.id)} onChange={() => toggle(setContactIds, c.id)} />
                          {c.name} <span className="text-xs text-muted-foreground">{reach ?? (sendVia === "email" ? "no email" : "no mobile number")}</span>
                        </label>
                      );
                    })}
                    {sendVia === "email" ? (
                      <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Other emails (comma-separated), e.g. a spouse or the designer"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
                    ) : (
                      <input value={extraPhones} onChange={(e) => setExtraPhones(e.target.value)} placeholder="Other mobile numbers (comma-separated), e.g. (602) 555-0100"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
                    )}
                    {target === "job" && (
                      <label className="flex items-center gap-2 pt-1 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={postToPortal} onChange={(e) => setPostToPortal(e.target.checked)} />
                        Also post it to the client portal as a project update
                      </label>
                    )}
                  </div>
                )}

                {people && sendVia === "email" && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{audience === "client" ? "Copy CMI staff (optional)" : "CMI team"}</div>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {people.staff.map((s) => (
                        <label key={s.id} className={cn("flex items-center gap-2 text-sm", !s.email && "opacity-50")}>
                          <input type="checkbox" className="h-4 w-4" disabled={!s.email} checked={staffIds.has(s.id)} onChange={() => toggle(setStaffIds, s.id)} />
                          {s.name}{s.onRecord && <span className="rounded bg-accent/15 px-1.5 text-[10px] text-accent">on this {target === "job" ? "job" : "project"}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{sendVia === "email" ? "Personal note at the top (optional)" : "Personal note before the link (optional)"}</div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={sendVia === "sms" ? 300 : 1000}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                </div>

                {sendVia === "sms" && draft && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">The text will read</div>
                    <div className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
                      {[note.trim() || null,
                        `Hi ${people?.contacts.find((c) => contactIds.has(c.id))?.name.split(/\s+/)[0] ?? "there"}, here's the latest update on ${name} from Constructed Matter: ${draft.headline}`,
                        "View or save the summary as a PDF: [link to this summary]",
                        target === "job" ? "Your project portal: [link to their portal]" : null,
                        "Reply STOP to opt out."].filter(Boolean).join("\n\n")}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => setSendVia(null)} disabled={busy === "send"}>Cancel</Button>
                  <Button size="sm" variant="accent" onClick={() => void send()}
                    disabled={busy === "send" || (audience === "client" && !people?.canSendToClient) || (!recipients && !(postToPortal && audience === "client" && target === "job"))}>
                    {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {sendVia === "email" ? "Send email" : "Send text"}{recipients ? ` to ${recipients}` : ""}
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
    </Shell>
  );
}

function ListEditor({ label, items, placeholder, onChange }: { label: string; items: string[]; placeholder: string; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {items.map((v, i) => (
        <div key={i} className="flex gap-1.5">
          <input value={v} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
          <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="h-3 w-3" /> Add item</button>
    </div>
  );
}
