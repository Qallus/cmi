import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseReporting, canEditReports, REPORTING_FLAG } from "@/lib/reporting/access";
import { getReport } from "@/lib/reporting/data";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { ReportDetailClient } from "./report-detail-client";

export const metadata = { title: "Weekly Report — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseReporting(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(REPORTING_FLAG))) notFound();

  const { id } = await params;
  const [report, people] = await Promise.all([getReport(id), loadAssignableStaff()]);
  if (!report) notFound();

  return (
    <ReportDetailClient
      initialReport={report}
      owners={people.map((p) => ({ id: p.id, name: p.name }))}
      canWrite={canEditReports(staff.role_slug)}
    />
  );
}
