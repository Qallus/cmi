import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { listSchedules, jobScheduleHeader } from "@/lib/schedules/data";
import { canEditSchedules, canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { SchedulesWorkspace } from "@/components/schedules/schedules-workspace";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedules — CMI Dashboard" };

async function loadStaff(): Promise<{ id: string; name: string }[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("staff_users").select("id, display_name, email").in("status", ["active", "invited"]).order("display_name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.display_name || s.email || "Staff" }));
}

// The Multi-Schedule Builder: one Job holds many independent Schedules
// (Construction, Procurement, Selections, …), each with phases, items,
// milestones, dependencies, and multiple views. Replaces the former
// project-manager-board-scoped-to-job (now the "Projects & Tasks" tab).
export default async function JobSchedulePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  const staffMember = await getSessionStaff();
  const role = staffMember?.role_slug ?? null;
  const [schedules, header, staff] = await Promise.all([listSchedules(job.id), jobScheduleHeader(job.id), loadStaff()]);
  const jobLabel = [job.job_number, job.job_name].filter(Boolean).join(" · ") || job.job_name;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="schedule" />
      {!canViewSchedules(role) ? (
        <div className="p-10 text-center text-sm text-muted-foreground">You don&apos;t have access to schedules.</div>
      ) : (
        <SchedulesWorkspace
          jobId={job.id}
          jobLabel={jobLabel}
          initialSchedules={schedules}
          initialHeader={header}
          staff={staff}
          canEdit={canEditSchedules(role)}
          canManage={canManageSchedules(role)}
        />
      )}
    </div>
  );
}
