import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUsePrequal, canDecidePrequal, PREQUAL_FLAG } from "@/lib/prequal/access";
import { listApplications } from "@/lib/prequal/review";
import { loadDirectory, loadComplianceWorklist, loadQualificationStats } from "@/lib/companies/directory";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { TradePartnersClient } from "./trade-partners-client";

export const metadata = { title: "Trade Partners — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function TradePartnersPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUsePrequal(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) notFound();

  const [applications, directory, compliance, stats, people] = await Promise.all([
    listApplications(),
    loadDirectory(),
    loadComplianceWorklist(),
    loadQualificationStats(),
    loadAssignableStaff(),
  ]);

  return (
    <TradePartnersClient
      initialApplications={applications}
      initialDirectory={directory}
      initialCompliance={compliance}
      stats={stats}
      reviewers={people.map((p) => ({ id: p.id, name: p.name }))}
      canDecide={canDecidePrequal(staff.role_slug)}
      isSuperAdmin={staff.role_slug === "super_admin"}
    />
  );
}
