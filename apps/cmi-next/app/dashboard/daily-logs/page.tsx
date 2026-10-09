import { loadAllDailyLogs, type DailyLogWithJob } from "@/lib/daily-logs/data";
import { AllDailyLogsClient } from "./all-daily-logs-client";

export const metadata = { title: "Daily Logs — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Every job's daily logs in one place. Each job keeps its own Daily Logs tab;
// this is the cross-job view for superintendents and PMs.
export default async function AllDailyLogsPage() {
  let logs: DailyLogWithJob[] = [];
  try { logs = await loadAllDailyLogs(); } catch { /* empty fallback */ }
  return <AllDailyLogsClient logs={logs} />;
}
