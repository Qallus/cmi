// "Someone put your name on this."
//
// Assignment was the largest silent gap in the dashboard: a deal owner, a task
// assignee, an interviewer and a job team member were all written straight to
// the database with nothing told to the person named. They found out by
// happening to look. Each helper below is deliberately a one-liner at the call
// site so adding one to a new write path stays cheap.
//
// All of them swallow their own errors via notifyStaff, so an assignment is
// never lost because the notification failed.
import { notifyStaff } from "@/lib/notifications/dispatch";

/** Only notify when the name actually changed, and never for self-assignment. */
function changed(next: string | null | undefined, previous: string | null | undefined): next is string {
  return !!next && next !== previous;
}

export async function notifyDealOwner(
  deal: { id: string; title?: string | null; job_number?: string | null; owner_id?: string | null; value?: number | null },
  actorId: string | null | undefined,
  previousOwnerId?: string | null,
): Promise<void> {
  if (!changed(deal.owner_id, previousOwnerId)) return;
  const name = (deal.title ?? "").trim() || deal.job_number || "an untitled deal";
  await notifyStaff({
    recipientIds: [deal.owner_id],
    actorId,
    kind: "deal_owner",
    title: `You now own ${name}`,
    body: "This deal is yours to move through the pipeline.",
    url: `/dashboard/pipeline/${deal.id}`,
    sourceTable: "deals",
    sourceId: deal.id,
    // One notice per person per deal-owner change; re-assigning back later
    // should notify again, so the key carries the owner.
    dedupeKey: `deal_owner:${deal.id}:${deal.owner_id}`,
    email: {
      subject: `You are now the owner of ${name}`,
      ctaLabel: "Open the deal",
      content: {
        eyebrow: "Pipeline",
        heading: `You now own ${name}`,
        paragraphs: ["You have been made the owner of this deal, so its next step is yours."],
        facts: [
          { label: "Deal", value: name },
          ...(deal.job_number ? [{ label: "Number", value: deal.job_number }] : []),
          ...(deal.value != null ? [{ label: "Value", value: `$${Number(deal.value).toLocaleString("en-US")}` }] : []),
        ],
        closing: "Logging a touch on the deal keeps the whole team's view current.",
      },
    },
  });
}

export async function notifyOpportunityOwner(
  opp: { id: string; opportunity_name?: string | null; job_number?: string | null; assigned_owner_id?: string | null },
  actorId: string | null | undefined,
  previousOwnerId?: string | null,
): Promise<void> {
  if (!changed(opp.assigned_owner_id, previousOwnerId)) return;
  const name = (opp.opportunity_name ?? "").trim() || opp.job_number || "an opportunity";
  await notifyStaff({
    recipientIds: [opp.assigned_owner_id],
    actorId,
    kind: "opportunity",
    title: `You now own ${name}`,
    body: "This pre-construction opportunity is assigned to you.",
    url: `/dashboard/sales/${opp.id}`,
    sourceTable: "pipeline_opportunities",
    sourceId: opp.id,
    dedupeKey: `opportunity:${opp.id}:${opp.assigned_owner_id}`,
    email: {
      subject: `You are now the owner of ${name}`,
      ctaLabel: "Open the opportunity",
      content: {
        eyebrow: "Pre-construction",
        heading: `You now own ${name}`,
        paragraphs: ["Moving it to the next stage is yours. The stage rail on the page lists exactly what each step needs before it will accept the move."],
        facts: [
          { label: "Opportunity", value: name },
          ...(opp.job_number ? [{ label: "Number", value: opp.job_number }] : []),
        ],
      },
    },
  });
}

export async function notifyTaskAssignee(
  task: { id: string; title: string; assigned_to?: string | null; due_at?: string | null; deal_id?: string | null; interview_id?: string | null; description?: string | null },
  actorId: string | null | undefined,
  previousAssignee?: string | null,
): Promise<void> {
  if (!changed(task.assigned_to, previousAssignee)) return;
  const url = task.deal_id ? `/dashboard/pipeline/${task.deal_id}` : "/dashboard/trade-partners";
  const due = task.due_at ? new Date(task.due_at) : null;
  const dueLabel = due && !Number.isNaN(due.getTime())
    ? due.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;
  await notifyStaff({
    recipientIds: [task.assigned_to],
    actorId,
    kind: "task",
    title: `New task: ${task.title}`,
    body: dueLabel ? `Due ${dueLabel}` : "No due date set.",
    url,
    sourceTable: "deal_tasks",
    sourceId: task.id,
    dedupeKey: `task:${task.id}:${task.assigned_to}`,
    email: {
      subject: dueLabel ? `Task for you — due ${dueLabel}` : "A task has been assigned to you",
      ctaLabel: "Open the task",
      content: {
        eyebrow: "Task assigned",
        heading: task.title,
        paragraphs: task.description ? [task.description] : [],
        facts: dueLabel ? [{ label: "Due", value: dueLabel }] : [],
        closing: "Mark it complete in the dashboard when it is done.",
      },
    },
  });
}

export async function notifyInterviewer(
  interview: { id: string; title?: string | null; interviewer_id?: string | null; scheduled_at?: string | null; company_name?: string | null },
  actorId: string | null | undefined,
  previousInterviewer?: string | null,
): Promise<void> {
  if (!changed(interview.interviewer_id, previousInterviewer)) return;
  const what = (interview.title ?? "").trim() || "an interview";
  const when = interview.scheduled_at ? new Date(interview.scheduled_at) : null;
  const whenLabel = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  await notifyStaff({
    recipientIds: [interview.interviewer_id],
    actorId,
    kind: "interview",
    title: `You are running ${what}`,
    body: whenLabel ?? "Not yet scheduled.",
    url: "/dashboard/trade-partners",
    sourceTable: "interviews",
    sourceId: interview.id,
    dedupeKey: `interview:${interview.id}:${interview.interviewer_id}`,
    email: {
      subject: whenLabel ? `You are interviewing — ${whenLabel}` : `You have been assigned ${what}`,
      ctaLabel: "Open the interview",
      content: {
        eyebrow: "Trade partner interview",
        heading: `You are running ${what}`,
        facts: [
          ...(interview.company_name ? [{ label: "Company", value: interview.company_name }] : []),
          ...(whenLabel ? [{ label: "When", value: whenLabel }] : []),
        ],
        paragraphs: ["The questions are prefilled from the company's application, so most of it is confirmation rather than fresh data entry."],
        closing: "Completing the interview writes the answers back onto the company record.",
      },
    },
  });
}

export async function notifyJobTeamAdded(
  job: { id: string; name?: string | null; job_number?: string | null },
  staffIds: (string | null | undefined)[],
  actorId: string | null | undefined,
  roleLabel?: string | null,
): Promise<void> {
  const name = (job.name ?? "").trim() || job.job_number || "a job";
  await notifyStaff({
    recipientIds: staffIds,
    actorId,
    kind: "job_team",
    title: `You were added to ${name}`,
    body: roleLabel ? `Your role: ${roleLabel}` : "You are now on this job's team.",
    url: `/dashboard/jobs/${job.id}`,
    sourceTable: "jobs",
    sourceId: job.id,
    dedupeKey: `job_team:${job.id}`,
    email: {
      subject: `You have been added to ${name}`,
      ctaLabel: "Open the job",
      content: {
        eyebrow: "Job team",
        heading: `You were added to ${name}`,
        facts: [
          { label: "Job", value: name },
          ...(job.job_number ? [{ label: "Number", value: job.job_number }] : []),
          ...(roleLabel ? [{ label: "Role", value: roleLabel }] : []),
        ],
        paragraphs: ["The job page carries its own schedule, tasks, documents and messages for everyone working on it."],
      },
    },
  });
}
