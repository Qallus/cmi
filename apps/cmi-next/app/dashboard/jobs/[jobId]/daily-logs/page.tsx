import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadDailyLogs } from "@/lib/daily-logs/data";
import { fieldReportsOn, listDayLogs } from "@/lib/daily-logs/reports";
import { todayAZ } from "@/lib/schedules/progress";
import { DailyLogsClient } from "./daily-logs-client";
import { FieldReportsClient, type FieldReportRow } from "./field-reports-client";
import { JobModuleShell } from "../job-module-shell";
import { getSessionStaff } from "@/lib/auth/server-session";

export const metadata = { title: "Daily Logs — CMI Dashboard" };
export const dynamic = "force-dynamic";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];
const REOPEN_ROLES = ["super_admin", "admin", "project_manager"];

export default async function DailyLogsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const staff = await getSessionStaff();
  const [logs, fieldReports] = await Promise.all([loadDailyLogs(jobId, staff?.id ?? null), fieldReportsOn()]);
  if (!fieldReports) return <DailyLogsClient jobId={jobId} jobName={job.job_name} initial={logs} />;

  // Field Reports: one log per day on top; logs from before it are kept below.
  const reports = await listDayLogs(jobId);
  const earlier = logs.filter((l) => !(l as { report_version?: number }).report_version || (l as { report_version?: number }).report_version === 1);
  const role = staff?.role_slug ?? "";
  return (
    <JobModuleShell jobId={jobId} jobName={job.job_name} active="daily-logs" title="Daily Logs">
      <FieldReportsClient jobId={jobId} initial={reports as unknown as FieldReportRow[]} today={todayAZ()} canEdit={WRITE_ROLES.includes(role)} canReopen={REOPEN_ROLES.includes(role)} />
      {earlier.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Earlier logs ({earlier.length})</summary>
          <div className="mt-3"><DailyLogsClient jobId={jobId} jobName={job.job_name} initial={earlier} embedded /></div>
        </details>
      ) : null}
    </JobModuleShell>
  );
}
