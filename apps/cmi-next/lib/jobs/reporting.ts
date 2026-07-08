// Pure job reporting helpers (feed the Jobs List stat tiles + Summary).
import { JOB_STATUS_META } from "./status";
import type { JobListRow } from "./data";
import type { JobStatus } from "./types";

export type JobReport = {
  total: number;
  by_status: Record<JobStatus, number>;
  active: number;      // open lifecycle statuses
  warranty: number;
  closed: number;
  total_contract_value: number;
  upcoming_starts: number;      // projected_start within 30 days
  upcoming_completions: number; // projected_completion within 30 days
  overdue_completions: number;  // projected_completion in the past, not complete
};

const num = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

export function computeJobReport(rows: JobListRow[], today: string): JobReport {
  const by_status = Object.fromEntries(
    (Object.keys(JOB_STATUS_META) as JobStatus[]).map((s) => [s, 0]),
  ) as Record<JobStatus, number>;

  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const horizon = in30.toISOString().slice(0, 10);

  let active = 0, warranty = 0, closed = 0, total_contract_value = 0;
  let upcoming_starts = 0, upcoming_completions = 0, overdue_completions = 0;

  for (const j of rows) {
    by_status[j.status] = (by_status[j.status] ?? 0) + 1;
    if (JOB_STATUS_META[j.status].open) active++;
    if (j.status === "warranty") warranty++;
    if (j.status === "closed") closed++;
    total_contract_value += num(j.contract_price);
    if (j.projected_start_date && j.projected_start_date >= today && j.projected_start_date <= horizon) upcoming_starts++;
    if (j.projected_completion_date && j.projected_completion_date >= today && j.projected_completion_date <= horizon) upcoming_completions++;
    if (j.projected_completion_date && j.projected_completion_date < today && j.status !== "closed" && j.status !== "warranty") overdue_completions++;
  }

  return { total: rows.length, by_status, active, warranty, closed, total_contract_value, upcoming_starts, upcoming_completions, overdue_completions };
}
