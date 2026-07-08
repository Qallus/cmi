"use client";

// Small shared UI helpers for the Jobs pages.
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_META, jobBadgeTone } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString()}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={jobBadgeTone(status)}>{JOB_STATUS_META[status].label}</Badge>;
}

// A small colored dot for the job's list/map/calendar color.
export function JobColorDot({ color }: { color: string | null | undefined }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: color || "transparent" }} />;
}
