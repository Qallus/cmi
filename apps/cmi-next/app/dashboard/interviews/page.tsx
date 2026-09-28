import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseInterviews, canManageTemplates, INTERVIEWS_FLAG } from "@/lib/interviews/access";
import { listInterviews, listTemplates, interviewStats } from "@/lib/interviews/data";
import { loadDirectory } from "@/lib/companies/directory";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { InterviewsClient } from "./interviews-client";

export const metadata = { title: "Interviews — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseInterviews(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(INTERVIEWS_FLAG))) notFound();

  const [interviews, templates, stats, directory, people] = await Promise.all([
    listInterviews(),
    listTemplates(),
    interviewStats(),
    loadDirectory(),
    loadAssignableStaff(),
  ]);

  return (
    <InterviewsClient
      initialInterviews={interviews}
      templates={templates}
      stats={stats}
      companies={directory.map((c) => ({ id: c.id, name: c.name, trades: c.trades ?? [] }))}
      staff={people.map((p) => ({ id: p.id, name: p.name }))}
      meId={staff.id}
      canManageTemplates={canManageTemplates(staff.role_slug)}
      isSuperAdmin={staff.role_slug === "super_admin"}
    />
  );
}
