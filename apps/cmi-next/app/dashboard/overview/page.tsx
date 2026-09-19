import { loadOverviewData } from "@/lib/overview/data";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadOutlook } from "@/lib/projections/data";
import { OverviewClient } from "./overview-client";
import { RevenueOutlookCard } from "./revenue-outlook-card";

export const metadata = { title: "Overview — CMI Dashboard" };

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [data, staff] = await Promise.all([loadOverviewData(), getSessionStaff()]);
  // Revenue Outlook is financial: loaded server-side for Admin / Super Admin
  // with the Projections flag on, never sent to anyone else.
  const outlook = staff && canUseProjections(staff.role_slug) && (await isFeatureEnabled(PROJECTIONS_FLAG))
    ? await loadOutlook().catch(() => null)
    : null;
  return <OverviewClient data={data} demoMode={false} outlookCard={outlook ? <RevenueOutlookCard outlook={outlook} /> : null} />;
}
