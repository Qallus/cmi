import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseReporting, canEditReports, REPORTING_FLAG } from "@/lib/reporting/access";
import { listReports, loadOpenActions } from "@/lib/reporting/data";
import { ReportingClient } from "./reporting-client";

export const metadata = { title: "Reporting — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Admin / PM only, behind the `reporting` flag. Anyone else gets a 404 so the
// page's existence isn't advertised.
export default async function ReportingPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseReporting(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(REPORTING_FLAG))) notFound();

  const [reports, actions] = await Promise.all([listReports(), loadOpenActions()]);
  return <ReportingClient initialReports={reports} initialActions={actions} canWrite={canEditReports(staff.role_slug)} />;
}
