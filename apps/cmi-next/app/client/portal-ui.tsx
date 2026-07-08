// Shared presentational helpers for the client portal (usable in server + client
// components — no "use client" directive; Badge is a plain span).
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_META, jobBadgeTone } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Clients see the friendly stage label for statuses that make sense to them.
export function ClientStatusBadge({ status }: { status: string }) {
  const meta = JOB_STATUS_META[status as JobStatus];
  if (!meta) return <Badge>{humanize(status)}</Badge>;
  return <Badge tone={jobBadgeTone(status as JobStatus)}>{meta.label}</Badge>;
}

export function ProgressBar({ percent }: { percent: number | null | undefined }) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>Progress</span><span className="font-semibold text-foreground">{p}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
