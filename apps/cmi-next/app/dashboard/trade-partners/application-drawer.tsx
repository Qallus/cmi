"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Check, ExternalLink, FileText, Loader2, ShieldCheck, ThumbsDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ApplicationDetail, CompanyDocument } from "@/lib/prequal/review";

type Reviewer = { id: string; name: string };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
                      <option key={s} value={s} disabled={!canDecide && (s === "approved" || s === "declined")}>{pretty(s)}</option>
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

        {canDecide && detail && (
          <footer className="space-y-2 border-t border-border px-5 py-3">
            <Textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Reason, if you're declining or want a note on the decision (optional)"
              className="min-h-[52px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void patch({ status: "declined", reason })}>
                <ThumbsDown className="h-4 w-4" /> Decline
              </Button>
              <Button variant="accent" disabled={busy} onClick={() => void patch({ status: "approved", reason })}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve as trade partner
              </Button>
            </div>
            {blocking.length > 0 && (
              <p className="text-right text-[11px] text-amber-700 dark:text-amber-300">
                {`${blocking.length} document ${blocking.length === 1 ? "issue" : "issues"} outstanding`} — approving anyway is allowed, but it&apos;s recorded.
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

  const hasFile = !!(doc.file_url || doc.file_id);
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
      </div>

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
    </li>
  );
}
