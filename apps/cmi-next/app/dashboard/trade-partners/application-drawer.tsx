"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, CalendarClock, Check, Copy, ExternalLink, FileText, Loader2, Mail, Send, ShieldCheck, Sparkles, ThumbsDown, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ApplicationDetail, CompanyDocument } from "@/lib/prequal/review";

type Reviewer = { id: string; name: string };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
/** Status names the office uses (brief §6). */
const STATUS_LABEL: Record<string, string> = {
  in_review: "Under review", info_requested: "Waiting on documents", interview: "Follow-up meeting",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? pretty(s);

const GAP_TONE: Record<string, string> = {
  missing_document: "text-amber-700 dark:text-amber-300",
  missing_answer: "text-muted-foreground",
  expiring: "text-amber-700 dark:text-amber-300",
  expired: "text-destructive",
  rejected: "text-destructive",
};

const DOC_TONE: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  uploaded: "bg-info/15 text-info",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  verified: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-destructive/15 text-destructive",
};

/**
 * One application, everything it carries, and the decisions a reviewer makes.
 * The gap list at the top is the point: it's what to chase, and later what the
 * interview should ask about.
 */
export function ApplicationDrawer({
  id, reviewers, canDecide, onClose, onChanged,
}: {
  id: string; reviewers: Reviewer[]; canDecide: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  // Footer mode: a decline reason, or an editable follow-up draft.
  const [mode, setMode] = React.useState<null | "decline" | "meeting" | "missing">(null);
  const [draft, setDraft] = React.useState<{ subject: string; body: string; to: string | null; replyTo: string; uploadUrl: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/trade-partners/applications/${id}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setDetail(json);
    else setError(json.error ?? "Couldn't load the application.");
  }, [id]);

  // `onClose` is a fresh closure on every parent render, so it can't be a
  // dependency here — the effect would cancel its own fetch before it landed.
  const closeRef = React.useRef(onClose);
  React.useEffect(() => { closeRef.current = onClose; }, [onClose]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch(`/api/trade-partners/applications/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) setDetail(json);
      else setError(json.error ?? "Couldn't load the application.");
    })();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { alive = false; window.removeEventListener("keydown", onKey); };
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/trade-partners/applications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "That didn't save."); return false; }
    await load();
    onChanged();
    return true;
  }

  async function decide(action: "approve" | "decline") {
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/trade-partners/applications/${id}/decision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action } : { action, reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "That didn't save."); return; }
    if (action === "approve") {
      const how = json.emailed?.sent ? "Onboarding email sent"
        : json.emailed?.held ? "Onboarding email queued (held outside production)"
        : "No contact email on file, so no onboarding email went out";
      setNotice(`Approved. ${how}${json.guideAttached ? " with the onboarding guide attached" : ""}.${json.outstanding?.length ? ` Still needed: ${json.outstanding.join(", ")}.` : ""}`);
    } else {
      setNotice("Declined and moved to Archive.");
    }
    setMode(null); setReason("");
    await load(); onChanged();
  }

  async function openDraft(kind: "meeting" | "missing") {
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/trade-partners/applications/${id}/drafts`);
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't prepare the email."); return; }
    const d = kind === "meeting" ? json.meeting : json.missing;
    setDraft({ subject: d.subject, body: d.body, to: json.to, replyTo: json.replyTo, uploadUrl: json.uploadUrl });
    setMode(kind);
  }

  async function sendDraft() {
    if (!draft || (mode !== "meeting" && mode !== "missing")) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/trade-partners/applications/${id}/email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: mode, subject: draft.subject, body: draft.body }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't send."); return; }
    setNotice(json.held ? "Email queued (held outside production). Status updated." : "Email sent. Status updated.");
    setMode(null); setDraft(null);
    await load(); onChanged();
  }

  async function copyUploadLink(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice("Upload link copied."); }
    catch { setNotice(url); }
  }

  const app = detail?.application;
  const gaps = detail?.gaps ?? [];
  // Documents and expiries are what hold up an approval. Unanswered optional
  // questions are not a problem — they're the agenda for the interview — so
  // they're listed separately rather than burying the real issues.
  const blocking = gaps.filter((g) => g.kind !== "missing_answer");
  const unanswered = gaps.filter((g) => g.kind === "missing_answer");

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Prequalification application">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prequalification</p>
            <h2 className="truncate font-serif text-xl">{detail?.company?.name ?? app?.company_name ?? "Application"}</h2>
            {app && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[app.contact_first_name, app.contact_last_name].filter(Boolean).join(" ")}
                {app.contact_email ? ` · ${app.contact_email}` : ""}
                {app.submitted_at ? ` · submitted ${when(app.submitted_at)}` : " · not submitted yet"}
              </p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {!detail ? (
            <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : (
            <>
              {/* Status + reviewer */}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</span>
                  <Select
                    className="w-auto min-w-[160px]" value={app?.status ?? "submitted"} disabled={busy}
                    onChange={(e) => void patch({ status: e.target.value })}
                  >
                    {["submitted", "in_review", "info_requested", "interview", "approved", "declined", "withdrawn"].map((s) => (
                      <option key={s} value={s} disabled={!canDecide && (s === "approved" || s === "declined")}>{statusLabel(s)}</option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reviewer</span>
                  <Select
                    className="w-auto min-w-[180px]" value={app?.reviewer_id ?? ""} disabled={busy}
                    onChange={(e) => void patch({ reviewer_id: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </label>
                {detail.company && (
                  <Link
                    href={`/dashboard/contacts?q=${encodeURIComponent(detail.company.name)}`}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    Contacts at this company <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* What to chase */}
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Needs attention
                  {blocking.length > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">{blocking.length}</span>
                  )}
                </h3>

                {blocking.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Documents are all on file and current.
                  </p>
                ) : (
                  <ul className="space-y-1 rounded-lg border border-border p-3 text-sm">
                    {blocking.map((g, i) => (
                      <li key={i} className={cn("flex items-start gap-2", GAP_TONE[g.kind])}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {g.label}
                          {g.detail && <span className="text-muted-foreground"> — {g.detail}</span>}
                          <span className="ml-1 text-[11px] text-muted-foreground">({pretty(g.kind)})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {unanswered.length > 0 && (
                  <details className="mt-2 rounded-lg border border-border p-3 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      {unanswered.length} question{unanswered.length === 1 ? "" : "s"} left blank — worth covering in the interview
                    </summary>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {unanswered.map((g, i) => (
                        <li key={i}>{g.label} <span className="opacity-70">({g.detail})</span></li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {/* Master Subcontractor Agreement */}
              <MsaBlock msa={detail.msa} canDecide={canDecide} onChanged={load} />

              {/* Documents */}
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</h3>
                {detail.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents were requested for this application.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {detail.documents.map((doc) => (
                      <DocumentRow key={doc.id} doc={doc} canDecide={canDecide} onChanged={load} />
                    ))}
                  </ul>
                )}
              </section>

              {/* What they told us */}
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">What they told us</h3>
                <div className="space-y-3">
                  {detail.groups.map((group) => (
                    <div key={group.title} className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-sm font-medium">{group.title}</p>
                      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                        {group.rows.map((row) => (
                          <div key={row.key} className="min-w-0">
                            <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                            <dd className="whitespace-pre-wrap break-words text-sm">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {detail && (
          <footer className="space-y-2 border-t border-border px-5 py-3">
            {notice && <p role="status" className="rounded-md bg-muted px-3 py-2 text-xs">{notice}</p>}

            {mode === "decline" && (
              <div className="space-y-2">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are we declining? Required, and kept with the application." className="min-h-[60px] text-sm" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  <Button variant="destructive" size="sm" disabled={busy || !reason.trim()} onClick={() => void decide("decline")}>
                    <ThumbsDown className="h-3.5 w-3.5" /> Decline and archive
                  </Button>
                </div>
              </div>
            )}

            {(mode === "meeting" || mode === "missing") && draft && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  To <span className="font-medium text-foreground">{draft.to ?? "no email on file"}</span> · from info@ · replies go to {draft.replyTo}
                </p>
                <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} aria-label="Subject" />
                <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Message" className="min-h-[220px] text-sm" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-accent hover:underline" onClick={() => void copyUploadLink(draft.uploadUrl)}>
                    <Copy className="h-3 w-3" /> Copy their upload link
                  </button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setMode(null); setDraft(null); }}>Cancel</Button>
                    <Button variant="accent" size="sm" disabled={busy || !draft.to} onClick={() => void sendDraft()}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send email
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!mode && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void openDraft("missing")}>
                  <Mail className="h-3.5 w-3.5" /> Follow up: missing documents
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void openDraft("meeting")}>
                  <CalendarClock className="h-3.5 w-3.5" /> Schedule follow-up meeting
                </Button>
                {canDecide && (
                  <>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode("decline")}>
                      <ThumbsDown className="h-3.5 w-3.5" /> Decline
                    </Button>
                    <Button variant="accent" size="sm" disabled={busy || app?.status === "approved"} onClick={() => void decide("approve")}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve as trade partner
                    </Button>
                  </>
                )}
              </div>
            )}
            {!mode && canDecide && blocking.length > 0 && (
              <p className="text-right text-[11px] text-amber-700 dark:text-amber-300">
                {`${blocking.length} document ${blocking.length === 1 ? "issue" : "issues"} outstanding`}. Approving is allowed; they stay red-flagged until resolved.
              </p>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function DocumentRow({ doc, canDecide, onChanged }: { doc: CompanyDocument; canDecide: boolean; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const [expires, setExpires] = React.useState(doc.expires_on ?? "");
  // Claude may fill the expiry after an upload; follow the saved value.
  React.useEffect(() => { setExpires(doc.expires_on ?? ""); }, [doc.expires_on]);
  // A read runs in the background after an upload; check back until it lands.
  React.useEffect(() => {
    if (doc.ai_status !== "pending") return;
    const t = setTimeout(() => { void onChanged(); }, 8000);
    return () => clearTimeout(t);
  }, [doc.ai_status, doc.updated_at, onChanged]);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/trade-partners/documents/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(false);
    await onChanged();
  }

  async function view() {
    const res = await fetch(`/api/trade-partners/documents/${doc.id}`);
    const json = await res.json().catch(() => ({}));
    if (json.url) window.open(json.url, "_blank", "noopener");
  }

  // Office upload: something a sub emailed in goes through the same tracking.
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true); setUploadError(null);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch(`/api/trade-partners/documents/${doc.id}/upload`, { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }
    await onChanged();
  }

  // Re-read the file with Claude (COI coverages, W-9, license).
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);
  async function reread() {
    setReading(true); setReadError(null);
    const res = await fetch(`/api/trade-partners/documents/${doc.id}/read`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setReading(false);
    if (!res.ok) { setReadError(json.error ?? "Couldn't read that document."); return; }
    await onChanged();
  }

  const hasFile = !!(doc.file_url || doc.file_id);
  const readable = hasFile && AI_READABLE.has(doc.doc_type);
  const expired = !!doc.expires_on && doc.expires_on < new Date().toISOString().slice(0, 10);

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{doc.label || pretty(doc.doc_type)}</p>
          <p className="text-[11px] text-muted-foreground">
            {doc.file_name ?? "Nothing uploaded"}
            {doc.license_number ? ` · ${doc.license_number}` : ""}
            {doc.carrier ? ` · ${doc.carrier}` : ""}
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", DOC_TONE[expired ? "expired" : doc.status])}>
          {expired ? "Expired" : pretty(doc.status)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {doc.doc_type !== "msa" && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="sr-only" aria-label={`Upload ${doc.label ?? doc.doc_type}`}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {hasFile ? "Replace" : "Upload"}
            </Button>
          </>
        )}
        {hasFile && (
          <Button size="sm" variant="outline" onClick={() => void view()}>
            <FileText className="h-3.5 w-3.5" /> View
          </Button>
        )}
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Expires
          <Input
            type="date" className="h-7 w-auto text-xs" value={expires} disabled={busy}
            onChange={(e) => setExpires(e.target.value)}
            onBlur={() => { if (expires !== (doc.expires_on ?? "")) void patch({ expires_on: expires || null }); }}
          />
        </label>
        {canDecide && hasFile && doc.status !== "verified" && (
          <Button size="sm" variant="accent" disabled={busy} onClick={() => void patch({ status: "verified" })}>
            <Check className="h-3.5 w-3.5" /> Verify
          </Button>
        )}
        {canDecide && hasFile && doc.status !== "rejected" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting((v) => !v)}>Reject</Button>
        )}
        {readable && (
          <Button size="sm" variant="ghost" disabled={busy || reading || doc.ai_status === "pending"} onClick={() => void reread()}
            title="Have Claude read the coverages, dates and limits again">
            {reading || doc.ai_status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {doc.ai_status === "parsed" ? "Re-read" : "Read with AI"}
          </Button>
        )}
      </div>

      {readable && <AiReading doc={doc} />}
      {readError && <p className="mt-1 text-[11px] text-destructive">{readError}</p>}

      {doc.rejection_reason && !rejecting && (
        <p className="mt-1 text-[11px] text-destructive">Rejected — {doc.rejection_reason}</p>
      )}

      {rejecting && (
        <div className="mt-2 flex gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's wrong with it?" className="h-8 text-xs" />
          <Button size="sm" variant="outline" disabled={busy || !reason.trim()}
            onClick={async () => { await patch({ status: "rejected", rejection_reason: reason }); setRejecting(false); setReason(""); }}>
            Save
          </Button>
        </div>
      )}
      {uploadError && <p className="mt-1 text-[11px] text-destructive">{uploadError}</p>}
    </li>
  );
}

const AI_READABLE = new Set(["coi", "gl", "wc", "auto", "w9", "license"]);
const usd = (n: number | null) => (n == null ? "?" : `$${n.toLocaleString("en-US")}`);
const LINE: Record<string, string> = {
  general_liability: "General liability", auto: "Auto", workers_comp: "Workers' comp",
  umbrella: "Umbrella", professional: "Professional", other: "Other",
};

/** What Claude read off the file: coverage lines against the minimums, and anything to check. */
function AiReading({ doc }: { doc: CompanyDocument }) {
  if (doc.ai_status === "pending") return <p className="mt-2 text-[11px] text-muted-foreground">Claude is reading this document…</p>;
  if (doc.ai_status === "failed") return <p className="mt-2 text-[11px] text-destructive">Claude couldn&apos;t read it{doc.ai_error ? `: ${doc.ai_error}` : "."}</p>;
  if (doc.ai_status === "skipped") return doc.ai_error ? <p className="mt-2 text-[11px] text-muted-foreground">Not read automatically: {doc.ai_error}</p> : null;
  if (doc.ai_status !== "parsed") return null;
  const coverages = doc.coverages ?? [];
  const flags = doc.ai_flags ?? [];
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
      <p className="flex items-center gap-1 font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Read by Claude{doc.ai_parsed_at ? ` · ${when(doc.ai_parsed_at)}` : ""} · check before verifying
      </p>
      {coverages.length > 0 ? (
        <table className="mt-1 w-full">
          <tbody>
            {coverages.map((c, i) => (
              <tr key={i} className="align-top">
                <td className="py-0.5 pr-2 font-medium">{LINE[c.line] ?? c.line}</td>
                <td className="py-0.5 pr-2">{c.carrier ?? "—"}{c.policy_number ? ` · ${c.policy_number}` : ""}</td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {c.line === "general_liability" ? `${usd(c.each_occurrence)} / ${usd(c.aggregate)}`
                    : c.line === "workers_comp" ? `EL ${usd(c.employers_liability_each_accident)}`
                    : usd(c.combined_single_limit ?? c.each_occurrence)}
                </td>
                <td className="py-0.5 pr-2 whitespace-nowrap">to {c.expiration_date ?? "?"}</td>
                <td className="py-0.5">
                  {c.meets_minimum === true && <Check className="h-3 w-3 text-emerald-600" aria-label="Meets minimum" />}
                  {c.meets_minimum === false && <AlertTriangle className="h-3 w-3 text-destructive" aria-label="Below minimum" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : doc.ai_summary ? <p className="mt-1">{doc.ai_summary}</p> : null}
      {flags.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
          {flags.map((f) => <li key={f} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{f}</li>)}
        </ul>
      )}
    </div>
  );
}

/** The MSA signed in the application, with countersign for Super Admin / Admin. */
function MsaBlock({ msa, canDecide, onChanged }: { msa: ApplicationDetail["msa"]; canDecide: boolean; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  async function countersign() {
    if (!msa) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/trade-partners/msa/countersign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature_id: msa.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't countersign."); return; }
    onChanged();
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Master Subcontractor Agreement</h3>
      {!msa ? (
        <p className="text-sm text-muted-foreground">Not signed in the application. Send the MSA for signature, or ask them to sign when they requalify.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <span>
            Signed by <span className="font-medium">{msa.signer_name}</span>{msa.signer_title ? `, ${msa.signer_title}` : ""} on {when(msa.signed_at)}
            <span className="block text-xs text-muted-foreground">
              {msa.countersigned_at ? `Countersigned by ${msa.countersigner_name} on ${when(msa.countersigned_at)}` : "Awaiting Constructed Matter countersignature"}
            </span>
          </span>
          {!msa.countersigned_at && canDecide && (
            <Button size="sm" variant="accent" disabled={busy} onClick={() => void countersign()}>{busy ? "Countersigning…" : "Countersign"}</Button>
          )}
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}
