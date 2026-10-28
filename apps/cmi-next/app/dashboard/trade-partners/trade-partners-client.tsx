"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardList, ExternalLink, FileWarning,
  Download, Flag, GitMerge, Inbox, Loader2, MessagesSquare, RefreshCw, Settings2, ShieldCheck, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TRADES, SERVICE_AREAS } from "@/lib/prequal/form";
import type { ApplicationRow } from "@/lib/prequal/review";
import type { DirectoryRow, ComplianceItem } from "@/lib/companies/directory";
import { ApplicationDrawer } from "./application-drawer";
import { ApplicationActions } from "./application-actions";
import { InterviewsPanel } from "../interviews/interviews-panel";
import { SetupPanel } from "./setup-panel";
import { DuplicatesPanel } from "./duplicates-panel";

type Tab = "applications" | "directory" | "compliance" | "interviews" | "setup";

// Which tab was last open, so coming back from an interview workspace
// lands where you left rather than on Applications.
const TAB_KEY = "cmi-trade-partners-tab";
type Reviewer = { id: string; name: string };

const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/15 text-info",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  info_requested: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  interview: "bg-accent/15 text-accent",
  approved: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  preferred: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  declined: "bg-destructive/15 text-destructive",
  applicant: "bg-info/15 text-info",
  prospect: "bg-muted text-muted-foreground",
};

const COMPLIANCE_TONE: Record<string, string> = {
  clear: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  expiring: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  expired: "bg-destructive/15 text-destructive",
  missing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  none: "bg-muted text-muted-foreground",
};

// Office names for the review states (brief §6); everything else reads as-is.
const STATUS_LABEL: Record<string, string> = { in_review: "Under review", info_requested: "Waiting on documents", interview: "Follow-up meeting" };
const pretty = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function TradePartnersClient({
  initialApplications, initialDirectory, initialCompliance, stats, reviewers, canDecide, isSuperAdmin,
  meId, interviewsEnabled, canManageTemplates,
}: {
  initialApplications: ApplicationRow[];
  initialDirectory: DirectoryRow[];
  initialCompliance: ComplianceItem[];
  stats: Record<string, number>;
  reviewers: Reviewer[];
  canDecide: boolean;
  isSuperAdmin: boolean;
  meId: string;
  interviewsEnabled: boolean;
  canManageTemplates: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("applications");

  // Restore after the first paint, so the server and client markup match.
  React.useEffect(() => {
    let saved: Tab | null = null;
    try { saved = window.localStorage.getItem(TAB_KEY) as Tab | null; } catch { /* private window */ }
    if (!saved || (saved === "interviews" && !interviewsEnabled)) return;
    // eslint-disable-next-line -- one-time restore of saved preference on mount
    setTab(saved);
  }, [interviewsEnabled]);

  const pickTab = React.useCallback((next: Tab) => {
    setTab(next);
    try { window.localStorage.setItem(TAB_KEY, next); } catch { /* fine */ }
  }, []);
  const [applications, setApplications] = React.useState(initialApplications);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  const refreshApplications = React.useCallback(async () => {
    const res = await fetch(`/api/trade-partners/applications${showArchived ? "?archived=1" : ""}`);
    if (res.ok) setApplications(await res.json());
  }, [showArchived]);

  // The archived list is a different query, so flipping the toggle refetches.
  // Skips the first run: the server already sent the un-archived page.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    void refreshApplications();
  }, [refreshApplications]);

  return (
    // Page padding and header typography follow the house pattern (see Selections):
    // the dashboard layout supplies no gutter, so every page brings its own.
    <div className="space-y-5 p-4 md:p-6">
      <header>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Prequalification</div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Trade Partners</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Prequalification applications, the partner directory, and what&apos;s missing or expiring.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Inbox} label="Awaiting review" value={stats.awaiting_review ?? 0} tone="text-info" />
        <Stat icon={ClipboardList} label="In review" value={(stats.in_review ?? 0) + (stats.info_requested ?? 0)} tone="text-amber-600" />
        <Stat icon={ShieldCheck} label="Approved partners" value={stats.approved ?? 0} tone="text-emerald-600" />
        <Stat icon={FileWarning} label="Compliance items" value={stats.compliance_items ?? 0} tone="text-destructive" />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {([
          ["applications", "Applications", Inbox],
          ["directory", "Directory", Building2],
          ["interviews", "Interviews", MessagesSquare],
          ["compliance", "Compliance", FileWarning],
          ["setup", "Setup", Settings2],
        ] as const).filter(([key]) => key !== "interviews" || interviewsEnabled).map(([key, label, Icon]) => (
          <button
            key={key} onClick={() => pickTab(key)}
            className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 transition",
              tab === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "applications" && (
        <Applications
          rows={applications} onOpen={setOpenId}
          archived={showArchived} onToggleArchived={setShowArchived}
          isSuperAdmin={isSuperAdmin}
          onChanged={() => void refreshApplications()}
          onRemoved={() => setOpenId(null)}
        />
      )}
      {tab === "directory" && <Directory initial={initialDirectory} canDecide={canDecide} />}
      {tab === "interviews" && interviewsEnabled && (
        <InterviewsPanel
          companies={initialDirectory.map((c) => ({ id: c.id, name: c.name, trades: c.trades ?? [] }))}
          staff={reviewers}
          meId={meId}
          canManageTemplates={canManageTemplates}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {tab === "compliance" && <Compliance initial={initialCompliance} />}
      {tab === "setup" && <SetupPanel canDecide={canDecide} />}

      {openId && (
        <ApplicationDrawer
          id={openId} reviewers={reviewers} canDecide={canDecide}
          onClose={() => setOpenId(null)}
          onChanged={() => void refreshApplications()}
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

// ─── Applications ───────────────────────────────────────────────────────────

function Applications({
  rows, onOpen, archived, onToggleArchived, isSuperAdmin, onChanged, onRemoved,
}: {
  rows: ApplicationRow[];
  onOpen: (id: string) => void;
  archived: boolean;
  onToggleArchived: (v: boolean) => void;
  isSuperAdmin: boolean;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const toggle = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={archived} onChange={(e) => onToggleArchived(e.target.checked)} />
      Show archived
    </label>
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{toggle}</div>
        <Empty
          icon={Inbox}
          title={archived ? "Nothing archived" : "No applications yet"}
          body={archived
            ? "Applications you archive are kept here, with every answer and document, and can be restored."
            : "Applications from the public prequalification page land here. Share constructedmatter.com/prequalification with a trade partner to get started."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
    <div className="flex justify-end">{toggle}</div>
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Documents</th>
            <th className="px-3 py-2 font-medium">Reviewer</th>
            <th className="px-3 py-2 font-medium">Submitted</th>
            <th className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-t border-border transition hover:bg-muted/40">
              <td className="px-3 py-2.5">
                <div className="font-medium">
                  {r.company_name_resolved || "Unnamed"}
                  {r.source === "requalification" && (
                    <span className="ml-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">Requalification</span>
                  )}
                </div>
                {r.progress < 100 && r.status === "draft" && (
                  <div className="text-[11px] text-muted-foreground">{r.progress}% complete</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {[r.contact_first_name, r.contact_last_name].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.partner_type || "—"}</td>
              <td className="px-3 py-2.5">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[r.status] ?? "bg-muted")}>{pretty(r.status)}</span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {r.docs_total === 0 ? "—" : r.docs_outstanding === 0
                  ? <span className="text-emerald-600 dark:text-emerald-400">All verified</span>
                  : `${r.docs_outstanding} of ${r.docs_total} outstanding`}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.reviewer_name || "Unassigned"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{when(r.submitted_at)}</td>
              <td className="px-3 py-2.5 text-right">
                <ApplicationActions
                  row={{
                    id: r.id, token: r.token,
                    label: r.company_name_resolved || [r.contact_first_name, r.contact_last_name].filter(Boolean).join(" ") || "this application",
                    contact_email: r.contact_email, contact_phone: r.contact_phone,
                    archived_at: r.archived_at ?? null,
                  }}
                  isSuperAdmin={isSuperAdmin} onOpen={onOpen}
                  onChanged={onChanged} onRemoved={onRemoved}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ─── Directory ──────────────────────────────────────────────────────────────

function Directory({ initial, canDecide }: { initial: DirectoryRow[]; canDecide: boolean }) {
  const [rows, setRows] = React.useState(initial);
  // Companies that were only ever a contact's employer stay out unless asked for.
  const [hidden, setHidden] = React.useState(false);
  const [dupes, setDupes] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [area, setArea] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // Requalification: pick partners, then send from the panel.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [requal, setRequal] = React.useState(false);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function setExcluded(id: string, excluded: boolean) {
    await fetch("/api/trade-partners/requalify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: id, excluded }) });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, requal_excluded: excluded } : r)));
    if (excluded) setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  React.useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (trade) params.set("trade", trade);
      if (area) params.set("area", area);
      if (status !== "all") params.set("status", status);
      if (value) params.set("value", value);
      if (hidden) params.set("hidden", "1");
      const res = await fetch(`/api/trade-partners/directory?${params}`);
      if (res.ok) setRows(await res.json());
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, trade, area, status, value, hidden, reload]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="w-auto min-w-[200px] flex-1" />
        <Select value={trade} onChange={(e) => setTrade(e.target.value)} className="w-auto min-w-[150px]">
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={area} onChange={(e) => setArea(e.target.value)} className="w-auto min-w-[150px]">
          <option value="">All areas</option>
          {SERVICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[140px]">
          <option value="all">Any status</option>
          {["prospect", "applicant", "in_review", "interview", "approved", "preferred", "declined"].map((s) => (
            <option key={s} value={s}>{pretty(s)}</option>
          ))}
        </Select>
        <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder="Job size $" className="w-[130px]" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Companies that came from contacts and never applied or got a partner type">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Show non-partner companies
        </label>
        {canDecide && <Button size="sm" variant="outline" onClick={() => setDupes((v) => !v)}><GitMerge className="h-3.5 w-3.5" /> Duplicates</Button>}
        <a href={`/api/trade-partners/export${hidden ? "?hidden=1" : ""}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted" title="Excel-ready list with cost codes, 1099 structure, contacts by role and document status">
          <Download className="h-3.5 w-3.5" /> Export to Excel
        </a>
        <a href="/api/trade-partners/insurance-export" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted" title="Every coverage line Claude read off each certificate: carrier, policy, limits, expiry, and whether it meets our minimums">
          <ShieldCheck className="h-3.5 w-3.5" /> Insurance tracking
        </a>
        {canDecide && (
          <Button size="sm" variant={selected.size ? "accent" : "outline"} onClick={() => setRequal((v) => !v)}>
            <RefreshCw className="h-3.5 w-3.5" /> Requalify{selected.size ? ` (${selected.size})` : ""}
          </Button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} companies</span>
      </div>

      {dupes && <DuplicatesPanel onClose={() => setDupes(false)} onMerged={() => setReload((n) => n + 1)} />}
      {requal && canDecide && (
        <RequalifyPanel
          rows={rows} selected={selected} setSelected={setSelected}
          onClose={() => setRequal(false)} onSent={() => { setSelected(new Set()); setReload((n) => n + 1); }}
        />
      )}

      {rows.length === 0 ? (
        <Empty icon={Building2} title="Nothing matches" body="Try widening the trade, area or job size." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id} className={cn("rounded-lg border bg-card p-4", c.red_flags.length ? "border-destructive/40" : "border-border")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {canDecide && (
                    <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                      aria-label={`Select ${c.name} for requalification`} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.partner_type, c.city].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[c.qualification_status] ?? "bg-muted")}>
                    {pretty(c.qualification_status)}
                  </span>
                  {c.docs_total > 0 && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", COMPLIANCE_TONE[c.compliance])}>
                      {c.compliance === "clear" ? "Docs verified"
                        : c.compliance === "missing" ? `${c.docs_outstanding} outstanding`
                        : pretty(c.compliance)}
                    </span>
                  )}
                </div>
              </div>

              {(c.trades?.length || c.service_areas?.length) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(c.trades ?? []).slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{t}</span>
                  ))}
                  {(c.service_areas ?? []).slice(0, 3).map((a) => (
                    <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
                  ))}
                </div>
              ) : null}

              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <div><dt>Project size</dt><dd className="text-foreground">{money(c.min_project_value)} – {money(c.max_project_value)}</dd></div>
                <div><dt>Crew</dt><dd className="text-foreground">{c.employee_count ?? "—"}</dd></div>
                <div><dt>At once</dt><dd className="text-foreground">{c.concurrent_capacity ?? "—"}</dd></div>
              </dl>

              {c.red_flags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.red_flags.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      <Flag className="h-3 w-3" /> {f}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {c.contact_count > 0 && (
                  <Link href={`/dashboard/contacts?q=${encodeURIComponent(c.name)}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                    <Users className="h-3 w-3" /> {c.contact_count} contact{c.contact_count === 1 ? "" : "s"}
                  </Link>
                )}
                {c.last_requalified_at && <span>Requalified {when(c.last_requalified_at)}</span>}
                {c.requal_requested_at && (!c.last_requalified_at || c.requal_requested_at > c.last_requalified_at) && (
                  <span>Update requested {when(c.requal_requested_at)}</span>
                )}
                {canDecide && (
                  <button type="button" className="ml-auto hover:text-foreground hover:underline" onClick={() => void setExcluded(c.id, !c.requal_excluded)}
                    title="Excluded partners are left out of select-all requalification sends">
                    {c.requal_excluded ? "Excluded from requalification · include" : "Exclude from requalification"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Send selected partners a pre-filled update form, with an optional note and MSA. */
function RequalifyPanel({ rows, selected, setSelected, onClose, onSent }: {
  rows: DirectoryRow[]; selected: Set<string>; setSelected: (s: Set<string>) => void; onClose: () => void; onSent: () => void;
}) {
  const [message, setMessage] = React.useState("");
  const [includeMsa, setIncludeMsa] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ sent: { company: string; email: string; held: boolean }[]; skipped: { company: string; reason: string }[] } | null>(null);
  const working = rows.filter((r) => ["approved", "preferred", "qualified"].includes(r.qualification_status));
  const eligible = working.filter((r) => !r.requal_excluded);
  const excluded = working.length - eligible.length;

  async function send() {
    if (!confirm(`Email ${selected.size} trade partner${selected.size === 1 ? "" : "s"} a requalification form?`)) return;
    setSending(true); setError(null); setResult(null);
    const res = await fetch("/api/trade-partners/requalify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_ids: [...selected], message, include_msa: includeMsa }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(json.error ?? "Couldn't send."); return; }
    setResult(json);
    onSent();
  }

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Requalify trade partners</p>
          <p className="text-xs text-muted-foreground">
            Each partner gets a link to their last application, already filled in. Expired or expiring documents are left blank to upload again.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{selected.size} selected</span>
        <Button size="sm" variant="outline" onClick={() => setSelected(new Set(eligible.map((r) => r.id)))}>
          Select all approved ({eligible.length})
        </Button>
        {selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>}
        {excluded > 0 && <span className="text-muted-foreground">{excluded} excluded partner{excluded === 1 ? "" : "s"} left out</span>}
      </div>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
        placeholder="Optional message to include, e.g. our minimums changed this year, or the new MSA is ready to sign." />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={includeMsa} onChange={(e) => setIncludeMsa(e.target.checked)} />
        Ask everyone to sign the current MSA again (partners who never signed the current version are always asked)
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="accent" disabled={sending || selected.size === 0} onClick={() => void send()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Send requalification
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      {result && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <p>
            Sent to {result.sent.length}{result.sent.some((s) => s.held) ? " (held: not production)" : ""}
            {result.skipped.length ? `, skipped ${result.skipped.length}` : ""}.
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              {result.skipped.map((s) => <li key={s.company}>{s.company}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Compliance ─────────────────────────────────────────────────────────────

function Compliance({ initial }: { initial: ComplianceItem[] }) {
  if (initial.length === 0) {
    return <Empty icon={CheckCircle2} title="Nothing outstanding" body="No documents are missing, rejected, expired, or expiring in the next 60 days." />;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {initial.map((item) => {
        const overdue = item.days_left != null && item.days_left < 0;
        const soon = item.days_left != null && item.days_left >= 0 && item.days_left <= 30;
        return (
          <li key={item.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.company_name}</p>
              <p className="text-xs text-muted-foreground">{item.label || pretty(item.doc_type)} · {pretty(item.status)}</p>
            </div>
            <div className="shrink-0 text-right text-xs">
              {item.expires_on ? (
                <span className={cn(overdue ? "text-destructive" : soon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  {overdue ? `Expired ${when(item.expires_on)}` : `Expires ${when(item.expires_on)}`}
                </span>
              ) : (
                <span className="text-muted-foreground">Not provided</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      <a
        href="/prequalification" target="_blank" rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        Open the application page <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
