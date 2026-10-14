import { loadAllDailyLogs, type DailyLogWithJob } from "@/lib/daily-logs/data";
import { AllDailyLogsClient } from "./all-daily-logs-client";
import { getSessionStaff } from "@/lib/auth/server-session";

export const metadata = { title: "Daily Logs — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Every job's daily logs in one place. Each job keeps its own Daily Logs tab;
// this is the cross-job view for superintendents and PMs.
export default async function AllDailyLogsPage() {
  let logs: DailyLogWithJob[] = [];
  const staff = await getSessionStaff();
  try { logs = await loadAllDailyLogs(500, staff?.id ?? null); } catch { /* empty fallback */ }
  return <AllDailyLogsClient logs={logs} />;
}
