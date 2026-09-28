import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseInterviews, INTERVIEWS_FLAG } from "@/lib/interviews/access";
import { getInterview, listEvents, listFollowups, prefilledKeys } from "@/lib/interviews/data";
import { getCompany } from "@/lib/companies/data";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { InterviewWorkspace } from "./interview-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const interview = await getInterview((await params).id).catch(() => null);
  return { title: `${interview?.title ?? "Interview"} — CMI Dashboard` };
}

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseInterviews(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(INTERVIEWS_FLAG))) notFound();

  const interview = await getInterview((await params).id);
  if (!interview) notFound();

  const company = interview.company_id ? await getCompany(interview.company_id) : null;
  const [events, followups, people] = await Promise.all([
    listEvents(interview.id),
    listFollowups(interview.id),
    loadAssignableStaff(),
  ]);

  return (
    <InterviewWorkspace
      initial={interview}
      company={company}
      initialEvents={events}
      initialFollowups={followups}
      staff={people.map((p) => ({ id: p.id, name: p.name }))}
      prefilled={prefilledKeys(interview.sections, company)}
    />
  );
}
