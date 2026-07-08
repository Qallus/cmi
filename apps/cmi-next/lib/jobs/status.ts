// Job status metadata + Buildertrend-style mapping + opportunity→job status
// derivation. See docs/features/job-features.md §Job Statuses.
import type { JobStatus } from "./types";

type Tone = "info" | "accent" | "warning" | "success" | "danger" | "muted";

export type JobStatusMeta = {
  status: JobStatus;
  label: string;
  tone: Tone;
  // Buildertrend-style bucket shown in some views (Presale/Open/Warranty/Closed).
  bt: "Presale" | "Open" | "Warranty" | "Closed" | "Draft" | "Inactive";
  // Whether the job is "active" (open) work.
  open: boolean;
};

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  draft:                   { status: "draft",                   label: "Draft",                    tone: "muted",   bt: "Draft",    open: false },
  opportunity:             { status: "opportunity",             label: "Opportunity",              tone: "info",    bt: "Presale",  open: true },
  active_budget:           { status: "active_budget",           label: "Active Budget",            tone: "accent",  bt: "Presale",  open: true },
  pre_construction_design: { status: "pre_construction_design", label: "Pre-Construction / Design", tone: "accent", bt: "Presale",  open: true },
  active_project:          { status: "active_project",          label: "Active Project",           tone: "success", bt: "Open",     open: true },
  warranty:                { status: "warranty",                label: "Warranty",                 tone: "warning", bt: "Warranty", open: true },
  closed:                  { status: "closed",                  label: "Closed",                   tone: "muted",   bt: "Closed",   open: false },
  long_lead:               { status: "long_lead",               label: "Long Lead",                tone: "warning", bt: "Presale",  open: true },
  not_moving_forward:      { status: "not_moving_forward",      label: "Not Moving Forward",       tone: "danger",  bt: "Inactive", open: false },
  on_hold:                 { status: "on_hold",                 label: "On Hold",                  tone: "warning", bt: "Inactive", open: false },
  cancelled:              { status: "cancelled",               label: "Cancelled",                tone: "danger",  bt: "Inactive", open: false },
};

export const ALL_JOB_STATUSES: JobStatus[] = Object.keys(JOB_STATUS_META) as JobStatus[];

// Map a job-meta tone onto a Badge tone ("muted" has no Badge equivalent).
export function jobBadgeTone(status: JobStatus): "default" | "accent" | "success" | "warning" | "danger" | "info" {
  const t = JOB_STATUS_META[status].tone;
  return t === "muted" ? "default" : t;
}

// When promoting an Opportunity to a Job, seed the job status from the
// opportunity's pipeline stage. Pipeline stages share the same slugs as job
// statuses (opportunity/active_budget/…), so the mapping is mostly 1:1 — but a
// brand-new promotion defaults to pre_construction_design (the "real project"
// threshold) unless the opportunity is already further along.
export function opportunityStageToJobStatus(stage: string | null | undefined): JobStatus {
  switch (stage) {
    case "active_project": return "active_project";
    case "warranty": return "warranty";
    case "closed": return "closed";
    case "long_lead": return "long_lead";
    case "not_moving_forward": return "not_moving_forward";
    case "pre_construction_design": return "pre_construction_design";
    case "active_budget": return "active_budget";
    case "opportunity": return "pre_construction_design"; // becoming a real project
    default: return "pre_construction_design";
  }
}
