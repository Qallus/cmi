import { redirect } from "next/navigation";
import { loadOverviewData } from "@/lib/overview/data";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled, loadFlags } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadOutlook } from "@/lib/projections/data";
import { DASHBOARD_FLAG } from "@/lib/dashboard/access";
import { loadDashboardData, loadDashboardLayout } from "@/lib/dashboard/data";
import { typesIn, STANDARD } from "@/lib/dashboard/layout";
import { Dashboard } from "@/components/dashboard/home/dashboard";
import { OverviewClient } from "./overview-client";
import { RevenueOutlookCard } from "./revenue-outlook-card";

export const metadata = { title: "Overview — CMI Dashboard" };

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  const flags = await loadFlags();

  // Revenue Outlook is financial: loaded server-side for Admin / Super Admin
  // with the Projections flag on, never sent to anyone else.
  const outlookFor = async () => (canUseProjections(staff.role_slug) && flags[PROJECTIONS_FLAG] === true ? loadOutlook().catch(() => null) : null);

  if (flags[DASHBOARD_FLAG] === true) {
    const { layout, chooser } = await loadDashboardLayout(staff, flags);
    const wantsOutlook = typesIn(layout ?? STANDARD).has("revenue_outlook");
    const [data, outlook] = await Promise.all([
      loadDashboardData(staff, layout, flags),
      wantsOutlook ? outlookFor() : Promise.resolve(null),
    ]);
    return <Dashboard initial={layout} chooser={chooser} data={data} slots={{ outlook: outlook ? <RevenueOutlookCard outlook={outlook} /> : undefined }} />;
  }

  const [data, outlook] = await Promise.all([loadOverviewData(), (await isFeatureEnabled(PROJECTIONS_FLAG)) ? outlookFor() : Promise.resolve(null)]);
  return <OverviewClient data={data} demoMode={false} outlookCard={outlook ? <RevenueOutlookCard outlook={outlook} /> : null} />;
}
