import { getSessionStaff } from "@/lib/auth/server-session";
import { canEditSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resources — CMI Dashboard" };

// Who's busy when, across every job (Schedules Phase 2 Step 7, flag schedule_progress).
export default async function ResourcesPage() {
  const staff = await getSessionStaff();
  if (!canViewSchedules(staff?.role_slug)) return <div className="p-10 text-center text-sm text-muted-foreground">You don&apos;t have access to schedules.</div>;
  if (!(await isFeatureEnabled("schedule_progress"))) return <div className="p-10 text-center text-sm text-muted-foreground">Resources come with progress tracking, which is switched off.</div>;
  return <ResourcesClient canEdit={canEditSchedules(staff?.role_slug)} />;
}
