"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardList, ExternalLink, FileWarning,
  Inbox, Loader2, ShieldCheck, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TRADES, SERVICE_AREAS } from "@/lib/prequal/form";
import type { ApplicationRow } from "@/lib/prequal/review";
import type { DirectoryRow, ComplianceItem } from "@/lib/companies/directory";
import { ApplicationDrawer } from "./application-drawer";

type Tab = "applications" | "directory" | "compliance";
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

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function TradePartnersClient({
  initialApplications, initialDirectory, initialCompliance, stats, reviewers, canDecide,
}: {
  initialApplications: ApplicationRow[];
  initialDirectory: DirectoryRow[];
  initialCompliance: ComplianceItem[];
  stats: Record<string, number>;
  reviewers: Reviewer[];
  canDecide: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("applications");
  const [applications, setApplications] = React.useState(initialApplications);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const refreshApplications = React.useCallback(async () => {
    const res = await fetch("/api/trade-partners/applications");
    if (res.ok) setApplications(await res.json());
  }, []);

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
          ["compliance", "Compliance", FileWarning],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 transition",
              tab === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "applications" && <Applications rows={applications} onOpen={setOpenId} />}
      {tab === "directory" && <Directory initial={initialDirectory} />}
      {tab === "compliance" && <Compliance initial={initialCompliance} />}

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

function Applications({ rows, onOpen }: { rows: ApplicationRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) {
    return (
      <Empty
        icon={Inbox}
        title="No applications yet"
        body="Applications from the public prequalification page land here. Share constructedmatter.com/prequalification with a trade partner to get started."
      />
    );
  }

  return (
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
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-t border-border transition hover:bg-muted/40">
              <td className="px-3 py-2.5">
                <div className="font-medium">{r.company_name_resolved || "Unnamed"}</div>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Directory ──────────────────────────────────────────────────────────────

function Directory({ initial }: { initial: DirectoryRow[] }) {
  const [rows, setRows] = React.useState(initial);
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [area, setArea] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (trade) params.set("trade", trade);
      if (area) params.set("area", area);
      if (status !== "all") params.set("status", status);
      if (value) params.set("value", value);
      const res = await fetch(`/api/trade-partners/directory?${params}`);
      if (res.ok) setRows(await res.json());
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, trade, area, status, value]);

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
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} companies</span>
      </div>

      {rows.length === 0 ? (
        <Empty icon={Building2} title="Nothing matches" body="Try widening the trade, area or job size." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.partner_type, c.city].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
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

              {c.contact_count > 0 && (
                <Link href={`/dashboard/contacts?q=${encodeURIComponent(c.name)}`} className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                  <Users className="h-3 w-3" /> {c.contact_count} contact{c.contact_count === 1 ? "" : "s"}
                </Link>
              )}
            </li>
          ))}
        </ul>
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
