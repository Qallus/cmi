import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { listScopeSchedules, scopeScheduleHeader, scopeLabel } from "@/lib/schedules/data";
import { canEditSchedules, canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { SCOPE_LABELS, type ScheduleScopeType } from "@/lib/schedules/types";
import { hrefForLink } from "@/lib/schedules/links";
import { SchedulesWorkspace } from "@/components/schedules/schedules-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedules — CMI Dashboard" };

async function loadStaff(): Promise<{ id: string; name: string }[]> {
  const { data } = await getSupabaseAdmin().from("staff_users").select("id, display_name, email").in("status", ["active", "invited"]).order("display_name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.display_name || s.email || "Staff" }));
}

// Schedules that belong to a Pipeline deal, Pre-Con record or selection
// (Schedule Builder). A job's schedules live on the job's Schedule tab.
export default async function ScopeSchedulesPage({ params, searchParams }: {
  params: Promise<{ scopeType: string; scopeId: string }>; searchParams: Promise<{ schedule?: string }>;
}) {
  const { scopeType, scopeId } = await params;
  const { schedule } = await searchParams;
  if (scopeType === "job") redirect(`/dashboard/jobs/${scopeId}/schedule${schedule ? `?schedule=${schedule}` : ""}`);
  if (!["deal", "precon", "selection"].includes(scopeType)) notFound();
  if (!(await isFeatureEnabled("schedule_builder"))) notFound();
  const staffMember = await getSessionStaff();
  const role = staffMember?.role_slug ?? null;
  if (!canViewSchedules(role)) return <div className="p-10 text-center text-sm text-muted-foreground">You don&apos;t have access to schedules.</div>;

  const scope = { type: scopeType as ScheduleScopeType, id: scopeId };
  const [schedules, header, label, staff, recordHref] = await Promise.all([
    listScopeSchedules(scope), scopeScheduleHeader(scope), scopeLabel(scope), loadStaff(), hrefForLink(scope.type, scope.id),
  ]);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 text-sm md:px-6">
        <Link href="/dashboard/schedules" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All schedules</Link>
        <span className="text-muted-foreground">·</span>
        <Link href={recordHref} className="text-muted-foreground hover:text-foreground">Open the {SCOPE_LABELS[scope.type].toLowerCase()}</Link>
      </div>
      <SchedulesWorkspace
        scope={scope}
        scopeLabel={`${SCOPE_LABELS[scope.type]} · ${label}`}
        initialSchedules={schedules}
        initialHeader={header}
        staff={staff}
        canEdit={canEditSchedules(role)}
        canManage={canManageSchedules(role)}
        builder
        initialScheduleId={schedule ?? null}
      />
    </div>
  );
}
