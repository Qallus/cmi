"use client";

import * as React from "react";
import {
  AlertTriangle, Bot, CheckCircle2, ClipboardList, ExternalLink, Loader2,
  RefreshCw, ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  PaperclipAgent, PaperclipApproval, PaperclipDashboard, PaperclipIssue, PaperclipUnavailable,
} from "@/lib/paperclip/types";

type Overview = {
  baseUrl: string | null;
  unavailable: PaperclipUnavailable | null;
  agents: PaperclipAgent[];
  issues: PaperclipIssue[];
  approvals: PaperclipApproval[];
  dashboard: PaperclipDashboard | null;
  partial: Record<string, PaperclipUnavailable | null> | null;
};

/** Only "error" is loud. An idle agent is the normal resting state. */
const STATUS_TONE: Record<string, string> = {
  running: "border-accent/40 bg-accent/10 text-accent",
  active: "border-accent/40 bg-accent/10 text-accent",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  paused: "border-border bg-muted text-muted-foreground",
  idle: "border-border bg-muted text-muted-foreground",
};

function tone(status: string | null | undefined): string {
  return STATUS_TONE[(status ?? "").toLowerCase()] ?? "border-border bg-muted text-muted-foreground";
}

function pretty(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function PaperclipPanel() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/paperclip/overview");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't load.");
      setData((await res.json()) as Overview);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking Paperclip…
      </div>
    );
  }

  if (error) return <Notice kind="error" title="Couldn't reach the dashboard API" body={error} onRetry={load} />;
  if (!data) return null;

  if (data.unavailable) {
    return <Unavailable reason={data.unavailable} baseUrl={data.baseUrl} onRetry={load} />;
  }

  const running = data.agents.filter((a) => ["running", "active"].includes((a.status ?? "").toLowerCase())).length;
  const errored = data.agents.filter((a) => (a.status ?? "").toLowerCase() === "error").length;
  const openApprovals = data.approvals.filter((a) => (a.status ?? "pending").toLowerCase() === "pending").length;

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Stat label="Agents" value={data.agents.length} />
          <Stat label="Working" value={running} tone={running > 0 ? "accent" : undefined} />
          <Stat label="Errored" value={errored} tone={errored > 0 ? "danger" : undefined} />
          <Stat label="Open tasks" value={data.issues.length} />
          <Stat label="Awaiting approval" value={openApprovals} tone={openApprovals > 0 ? "accent" : undefined} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
          {data.baseUrl && (
            <a
              href={data.baseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent"
            >
              Open Paperclip <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
        </div>
      </div>

      {/* A partly-working key is worth saying out loud — otherwise an empty
          section reads as "nothing here" rather than "not allowed". */}
      {data.partial && Object.entries(data.partial).some(([, v]) => v) && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Some sections didn&apos;t load:{" "}
          {Object.entries(data.partial).filter(([, v]) => v).map(([k, v]) => `${k} (${v!.reason})`).join(", ")}.
        </div>
      )}

      <Section icon={Bot} title="Agents" count={data.agents.length} empty="No agents yet. Create one in Paperclip and it appears here.">
        {data.agents.map((agent) => (
          <li key={agent.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{agent.name || agent.id}</span>
            {agent.role && <span className="text-xs text-muted-foreground">{pretty(agent.role)}</span>}
            {agent.adapterType && (
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {agent.adapterType}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{when(agent.lastHeartbeatAt)}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone(agent.status))}>
              {pretty(agent.status)}
            </span>
          </li>
        ))}
      </Section>

      <Section icon={ClipboardList} title="Tasks" count={data.issues.length} empty="No open tasks.">
        {data.issues.slice(0, 25).map((issue) => (
          <li key={issue.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm">{issue.title || issue.id}</span>
            <span className="text-xs text-muted-foreground">{when(issue.updatedAt ?? issue.createdAt)}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone(issue.status))}>
              {pretty(issue.status)}
            </span>
          </li>
        ))}
      </Section>

      <Section
        icon={CheckCircle2}
        title="Approvals"
        count={data.approvals.length}
        empty="Nothing waiting on a human."
        footer={data.baseUrl ? { href: `${data.baseUrl}`, label: "Approve in Paperclip" } : undefined}
      >
        {data.approvals.slice(0, 25).map((approval) => (
          <li key={approval.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm">{approval.title || approval.kind || approval.id}</span>
            <span className="text-xs text-muted-foreground">{when(approval.createdAt)}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone(approval.status))}>
              {pretty(approval.status ?? "pending")}
            </span>
          </li>
        ))}
      </Section>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        Read-only. Agents are started, paused and approved in Paperclip until the audit trail on this side is in place.
      </p>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────── */

function Stat({ label, value, tone: t }: { label: string; value: number; tone?: "accent" | "danger" }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-1.5",
      t === "danger" ? "border-destructive/40 bg-destructive/5"
        : t === "accent" ? "border-accent/40 bg-accent/5" : "border-border bg-card",
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums",
        t === "danger" ? "text-destructive" : t === "accent" ? "text-accent" : "")}>{value}</div>
    </div>
  );
}

function Section({
  icon: Icon, title, count, empty, children, footer,
}: {
  icon: React.ElementType; title: string; count: number; empty: string;
  children: React.ReactNode; footer?: { href: string; label: string };
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {count === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
      {footer && count > 0 && (
        <div className="border-t border-border px-4 py-2">
          <a href={footer.href} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            {footer.label} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </section>
  );
}

/**
 * The four reasons the panel can be empty, each said in its own words.
 * "Not set up yet" and "the server is down" need different responses from
 * whoever is reading, so they must not share a message.
 */
function Unavailable({
  reason, baseUrl, onRetry,
}: { reason: PaperclipUnavailable; baseUrl: string | null; onRetry: () => void }) {
  if (reason.reason === "unconfigured") {
    return (
      <Notice
        kind="setup"
        title="Paperclip isn't connected yet"
        body={
          <>
            <p className="mb-2">
              Add these to the environment, then redeploy. They are read on the server only and never reach the browser.
            </p>
            <ul className="mb-2 space-y-1">
              {reason.missing.map((key) => (
                <li key={key}><code className="rounded bg-muted px-1 py-0.5 text-xs">{key}</code></li>
              ))}
            </ul>
            <p className="text-xs">
              The key is an <strong>agent API key</strong>{" "}from Paperclip (Agents → the agent → API key), not a
              board login — board endpoints use session cookies and can&apos;t be called server-to-server.
            </p>
          </>
        }
        onRetry={onRetry}
      />
    );
  }

  if (reason.reason === "unauthorized") {
    return (
      <Notice
        kind="error"
        title="Paperclip refused the key"
        body={
          <>
            <p className="mb-1">{reason.detail}</p>
            <p className="text-xs">
              Check <code className="rounded bg-muted px-1 py-0.5 text-xs">PAPERCLIP_API_KEY</code> and that{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">PAPERCLIP_COMPANY_ID</code> is the company that
              issued it — keys are scoped to one company.
            </p>
          </>
        }
        onRetry={onRetry}
        baseUrl={baseUrl}
      />
    );
  }

  return (
    <Notice
      kind="error"
      title={reason.reason === "unreachable" ? "Paperclip isn't responding" : "Paperclip returned an error"}
      body={
        <>
          <p className="mb-1">{reason.detail}</p>
          <p className="text-xs">The rest of the dashboard is unaffected — nothing here depends on Paperclip.</p>
        </>
      }
      onRetry={onRetry}
      baseUrl={baseUrl}
    />
  );
}

function Notice({
  kind, title, body, onRetry, baseUrl,
}: {
  kind: "setup" | "error"; title: string; body: React.ReactNode;
  onRetry?: () => void; baseUrl?: string | null;
}) {
  const Icon = kind === "setup" ? ShieldQuestion : AlertTriangle;
  return (
    <div className="flex h-full items-start justify-center pt-10">
      <div className={cn(
        "max-w-lg rounded-xl border p-5",
        kind === "setup" ? "border-border bg-card" : "border-warning/40 bg-warning/10",
      )}>
        <div className="mb-2 flex items-center gap-2">
          <Icon className={cn("h-4 w-4", kind === "setup" ? "text-accent" : "text-warning")} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="text-sm text-muted-foreground">{body}</div>
        <div className="mt-3 flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          )}
          {baseUrl && (
            <a href={baseUrl} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 hover:text-accent">
              Open Paperclip <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
