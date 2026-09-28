// Interviews: the data layer.
//
// An interview is a template's questions, a person, and the answers given on
// the day. The point of the module is the last step — `completeInterview`
// pushes mapped answers onto the company, so what was said in a meeting
// becomes something the Directory can filter on.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCompany, updateCompany, type Company } from "@/lib/companies/data";
import { createDealTask, loadDealTasks, updateDealTask } from "@/lib/deals/data";
import type { DealTask } from "@/lib/deals/types";
import { answersToCompany, progressOf, type Answers, type Section } from "@/lib/prequal/form";
import { SEED_TEMPLATES } from "./seed-templates";

export class InterviewError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export const INTERVIEW_STATUSES = [
  "draft", "invited", "scheduled", "confirmed", "in_progress", "completed",
  "follow_up", "awaiting_documents", "approved", "not_moving_forward",
  "reschedule", "cancelled",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Statuses that still need somebody to do something. */
export const OPEN_STATUSES: InterviewStatus[] = [
  "draft", "invited", "scheduled", "confirmed", "in_progress", "follow_up", "awaiting_documents", "reschedule",
];

export type InterviewTemplate = {
  id: string;
  name: string;
  description: string | null;
  contact_type: string | null;
  trade: string | null;
  duration_minutes: number;
  status: "active" | "inactive";
  sections: Section[];
  default_tags: string[];
  seed_key: string | null;
  created_at: string;
  updated_at: string;
};

export type Interview = {
  id: string;
  template_id: string | null;
  sections: Section[];
  contact_id: string | null;
  company_id: string | null;
  job_id: string | null;
  deal_id: string | null;
  application_id: string | null;
  interviewer_id: string | null;
  participants: string[];
  title: string;
  interview_type: string | null;
  status: InterviewStatus;
  booking_id: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  location: string | null;
  meeting_type: string | null;
  meeting_url: string | null;
  started_at: string | null;
  completed_at: string | null;
  answers: Answers;
  progress: number;
  recording_id: string | null;
  transcript: string | null;
  ai_summary: string | null;
  internal_notes: string | null;
  strengths: string | null;
  concerns: string | null;
  recommended_next_step: string | null;
  tags: string[];
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InterviewRow = Interview & {
  contact_name: string | null;
  company_name: string | null;
  interviewer_name: string | null;
  template_name: string | null;
  open_followups: number;
};

/**
 * A follow-up is an ordinary staff task, not an interview-only thing — it
 * lives in `deal_tasks` alongside every other task so it turns up wherever
 * someone's workload is listed. `deal_tasks.interview_id` is what ties it back.
 */
export type Followup = DealTask;

export type InterviewEvent = {
  id: string;
  interview_id: string;
  kind: string;
  detail: string | null;
  actor_id: string | null;
  created_at: string;
};

// ─── Templates ──────────────────────────────────────────────────────────────

/**
 * Active templates, seeding the built-in ones the first time.
 *
 * Seeding here rather than in a migration keeps the questionnaire in TypeScript
 * where it can be reviewed in a diff, and means a fresh database needs no
 * separate step. `seed_key` is unique, so this is idempotent; a template an
 * admin has edited by hand has no seed key and is never touched.
 */
export async function listTemplates(opts: { includeInactive?: boolean } = {}): Promise<InterviewTemplate[]> {
  const supabase = getSupabaseAdmin();
  await ensureSeeded();

  let query = supabase.from("interview_templates").select("*").order("name");
  if (!opts.includeInactive) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw new InterviewError(error.message, 500);
  return (data ?? []) as InterviewTemplate[];
}

let seedChecked = false;

async function ensureSeeded(): Promise<void> {
  if (seedChecked) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("interview_templates").select("seed_key").not("seed_key", "is", null);
  const have = new Set(((data ?? []) as { seed_key: string }[]).map((r) => r.seed_key));
  const missing = SEED_TEMPLATES.filter((t) => !have.has(t.seed_key));
  if (missing.length > 0) {
    await supabase.from("interview_templates").insert(missing.map((t) => ({
      seed_key: t.seed_key,
      name: t.name,
      description: t.description,
      contact_type: t.contact_type,
      trade: t.trade,
      duration_minutes: t.duration_minutes,
      default_tags: t.default_tags,
      sections: t.sections,
    })));
  }
  seedChecked = true;
}

export async function getTemplate(id: string): Promise<InterviewTemplate | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("interview_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw new InterviewError(error.message, 500);
  return (data as InterviewTemplate) ?? null;
}

export async function saveTemplate(
  id: string | null, patch: Partial<InterviewTemplate>, actorId: string | null,
): Promise<InterviewTemplate> {
  const supabase = getSupabaseAdmin();
  const allowed: Record<string, unknown> = {};
  for (const key of ["name", "description", "contact_type", "trade", "duration_minutes", "status", "sections", "default_tags"] as const) {
    if (typeof patch[key] !== "undefined") allowed[key] = patch[key];
  }
  if (!id) {
    if (!allowed.name) throw new InterviewError("A template needs a name.");
    const { data, error } = await supabase.from("interview_templates")
      .insert({ ...allowed, created_by: actorId }).select().single();
    if (error) throw new InterviewError(error.message, 500);
    return data as InterviewTemplate;
  }
  const { data, error } = await supabase.from("interview_templates")
    .update({ ...allowed, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new InterviewError(error.message, 500);
  return data as InterviewTemplate;
}

// ─── Interviews ─────────────────────────────────────────────────────────────

const LIST_SELECT =
  "*, contacts(first_name, last_name), companies(name), interview_templates(name), staff_users!interviews_interviewer_id_fkey(display_name, email)";

type Joined = Interview & {
  contacts: { first_name: string | null; last_name: string | null } | null;
  companies: { name: string } | null;
  interview_templates: { name: string } | null;
  staff_users: { display_name: string | null; email: string | null } | null;
};

function shape(rows: Joined[], followups: Map<string, number>): InterviewRow[] {
  return rows.map((r) => ({
    ...r,
    contacts: undefined as never,
    companies: undefined as never,
    interview_templates: undefined as never,
    staff_users: undefined as never,
    contact_name: [r.contacts?.first_name, r.contacts?.last_name].filter(Boolean).join(" ") || null,
    company_name: r.companies?.name ?? null,
    template_name: r.interview_templates?.name ?? null,
    interviewer_name: r.staff_users?.display_name || r.staff_users?.email || null,
    open_followups: followups.get(r.id) ?? 0,
  })) as InterviewRow[];
}

export async function listInterviews(opts: {
  status?: string;
  interviewerId?: string;
  contactId?: string;
  companyId?: string;
  templateId?: string;
  archived?: boolean;
  q?: string;
} = {}): Promise<InterviewRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("interviews").select(LIST_SELECT)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (opts.status && opts.status !== "all") {
    query = opts.status === "open" ? query.in("status", OPEN_STATUSES) : query.eq("status", opts.status);
  }
  if (opts.interviewerId) query = query.eq("interviewer_id", opts.interviewerId);
  if (opts.contactId) query = query.eq("contact_id", opts.contactId);
  if (opts.companyId) query = query.eq("company_id", opts.companyId);
  if (opts.templateId) query = query.eq("template_id", opts.templateId);
  if (opts.q) query = query.ilike("title", `%${opts.q}%`);

  const { data, error } = await query;
  if (error) throw new InterviewError(error.message, 500);
  const rows = (data ?? []) as unknown as Joined[];
  return shape(rows, await openFollowupCounts(rows.map((r) => r.id)));
}

async function openFollowupCounts(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data } = await getSupabaseAdmin()
    .from("deal_tasks").select("interview_id").in("interview_id", ids).is("completed_at", null);
  for (const row of (data ?? []) as { interview_id: string }[]) {
    out.set(row.interview_id, (out.get(row.interview_id) ?? 0) + 1);
  }
  return out;
}

export async function interviewStats(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("interviews")
    .select("status, scheduled_at").is("archived_at", null);
  const rows = (data ?? []) as { status: string; scheduled_at: string | null }[];

  const now = Date.now();
  const endOfWeek = now + 7 * 86_400_000;
  const today = new Date().toISOString().slice(0, 10);

  const stats: Record<string, number> = {
    upcoming: 0, today: 0, this_week: 0, in_progress: 0,
    follow_up: 0, awaiting_documents: 0, completed: 0, draft: 0,
  };
  for (const r of rows) {
    if (r.status in stats) stats[r.status] += 1;
    if (r.scheduled_at) {
      const t = new Date(r.scheduled_at).getTime();
      const scheduledAhead = t >= now && !["completed", "cancelled", "not_moving_forward"].includes(r.status);
      if (scheduledAhead) stats.upcoming += 1;
      if (scheduledAhead && t <= endOfWeek) stats.this_week += 1;
      if (r.scheduled_at.slice(0, 10) === today) stats.today += 1;
    }
  }

  const { count } = await supabase.from("deal_tasks")
    .select("id", { count: "exact", head: true })
    .not("interview_id", "is", null).is("completed_at", null);
  stats.open_followups = count ?? 0;
  return stats;
}

export async function getInterview(id: string): Promise<InterviewRow | null> {
  const { data, error } = await getSupabaseAdmin().from("interviews").select(LIST_SELECT).eq("id", id).maybeSingle();
  if (error) throw new InterviewError(error.message, 500);
  if (!data) return null;
  const row = data as unknown as Joined;
  return shape([row], await openFollowupCounts([row.id]))[0];
}

export async function createInterview(input: {
  templateId: string;
  contactId?: string | null;
  companyId?: string | null;
  applicationId?: string | null;
  interviewerId?: string | null;
  title?: string | null;
  interviewType?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  meetingType?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
}, actorId: string | null): Promise<Interview> {
  const template = await getTemplate(input.templateId);
  if (!template) throw new InterviewError("That interview template no longer exists.", 404);

  const company = input.companyId ? await getCompany(input.companyId) : null;

  const { data, error } = await getSupabaseAdmin().from("interviews").insert({
    template_id: template.id,
    // A snapshot: editing the template later must not rewrite what was asked.
    sections: template.sections,
    contact_id: input.contactId ?? null,
    company_id: input.companyId ?? null,
    application_id: input.applicationId ?? null,
    interviewer_id: input.interviewerId ?? actorId,
    title: input.title?.trim() || `${template.name} — ${company?.name ?? "New partner"}`,
    interview_type: input.interviewType ?? template.contact_type,
    status: input.scheduledAt ? "scheduled" : "draft",
    scheduled_at: input.scheduledAt ?? null,
    duration_minutes: input.durationMinutes ?? template.duration_minutes,
    meeting_type: input.meetingType ?? null,
    location: input.location ?? null,
    meeting_url: input.meetingUrl ?? null,
    // Prefill from what the partner already told us, so the meeting is spent
    // on the gaps rather than re-reading the application back to them.
    answers: company ? prefillFromCompany(template.sections, company) : {},
    tags: template.default_tags,
    created_by: actorId,
  }).select().single();
  if (error) throw new InterviewError(error.message, 500);

  const interview = data as Interview;
  await logEvent(interview.id, "created", `From template “${template.name}”`, actorId);
  if (input.scheduledAt) await logEvent(interview.id, "scheduled", input.scheduledAt, actorId);
  return interview;
}

const ARRAY_KEYS = new Set(["trades", "capabilities", "service_areas", "pricing_methods", "equipment", "certifications"]);

/**
 * Seed an interview's answers from the company record.
 *
 * Every question carrying `mapsTo` is a question we may already know the
 * answer to. Filling those in turns the interview from an interrogation into a
 * review — the interviewer confirms or corrects, and spends the time on what's
 * actually blank.
 */
export function prefillFromCompany(sections: readonly Section[], company: Company): Answers {
  const answers: Answers = {};
  const record = company as unknown as Record<string, unknown>;
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.mapsTo) continue;
      const value = record[field.mapsTo];
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        answers[field.key] = ARRAY_KEYS.has(field.mapsTo) && field.type !== "multiselect"
          ? value.join("\n")
          : value;
      } else {
        answers[field.key] = value as Answers[string];
      }
    }
  }
  return answers;
}

/** Which answers came from the profile rather than the conversation. */
export function prefilledKeys(sections: readonly Section[], company: Company | null): string[] {
  if (!company) return [];
  return Object.keys(prefillFromCompany(sections, company));
}

export async function saveAnswers(id: string, answers: Answers, actorId: string | null): Promise<Interview> {
  const current = await getInterview(id);
  if (!current) throw new InterviewError("Interview not found.", 404);
  if (current.completed_at) throw new InterviewError("This interview is complete. Reopen it to make changes.", 409);

  const patch: Record<string, unknown> = {
    answers,
    progress: progressOf(answers, current.sections),
    updated_at: new Date().toISOString(),
  };
  // First answer typed is the interview actually starting.
  if (!current.started_at) {
    patch.started_at = new Date().toISOString();
    patch.status = "in_progress";
  }

  const { data, error } = await getSupabaseAdmin()
    .from("interviews").update(patch).eq("id", id).select().single();
  if (error) throw new InterviewError(error.message, 500);
  if (!current.started_at) await logEvent(id, "started", null, actorId);
  return data as Interview;
}

export async function updateInterview(id: string, patch: Partial<Interview>, actorId: string | null): Promise<Interview> {
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "title", "status", "interviewer_id", "participants", "scheduled_at", "duration_minutes",
    "location", "meeting_type", "meeting_url", "internal_notes", "strengths", "concerns",
    "recommended_next_step", "tags", "transcript", "ai_summary", "recording_id",
    "contact_id", "company_id", "archived_at",
  ] as const) {
    if (typeof patch[key] !== "undefined") allowed[key] = patch[key];
  }
  if (Object.keys(allowed).length === 0) throw new InterviewError("Nothing to change.");

  const { data, error } = await getSupabaseAdmin()
    .from("interviews").update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw new InterviewError(error.message, 500);

  if (typeof allowed.status === "string") await logEvent(id, "status", String(allowed.status), actorId);
  if (typeof allowed.scheduled_at === "string") await logEvent(id, "scheduled", String(allowed.scheduled_at), actorId);
  return data as Interview;
}

/**
 * Close the interview and push what was learned onto the company.
 *
 * This is the step the whole module exists for. Without it an interview is a
 * document nobody opens again; with it, "works in Scottsdale, prices from
 * plans, ideal job $25–150k" becomes something the Directory can filter.
 */
export async function completeInterview(
  id: string,
  opts: { applyToProfile?: boolean; summary?: string | null },
  actorId: string | null,
): Promise<{ interview: Interview; applied: string[] }> {
  const current = await getInterview(id);
  if (!current) throw new InterviewError("Interview not found.", 404);

  const applied: string[] = [];
  if (opts.applyToProfile !== false && current.company_id) {
    const patch = answersToCompany(current.answers, current.sections);
    if (Object.keys(patch).length > 0) {
      await updateCompany(current.company_id, patch as Partial<Company>, actorId);
      applied.push(...Object.keys(patch));
    }
  }

  const answers = current.answers as Record<string, unknown>;
  const { data, error } = await getSupabaseAdmin().from("interviews").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    ai_summary: opts.summary ?? current.ai_summary,
    // Section O lives in the answers; lift it onto the row so the list and the
    // contact tab can show it without parsing the questionnaire.
    strengths: str(answers.strengths) ?? current.strengths,
    concerns: str(answers.concerns) ?? current.concerns,
    recommended_next_step: str(answers.recommended_next_step) ?? current.recommended_next_step,
    internal_notes: str(answers.internal_comments) ?? current.internal_notes,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();
  if (error) throw new InterviewError(error.message, 500);

  await logEvent(id, "completed", applied.length ? `${applied.length} profile fields updated` : null, actorId);
  return { interview: data as Interview, applied };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Put a completed interview back into progress. */
export async function reopenInterview(id: string, actorId: string | null): Promise<Interview> {
  const { data, error } = await getSupabaseAdmin().from("interviews")
    .update({ status: "in_progress", completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw new InterviewError(error.message, 500);
  await logEvent(id, "reopened", null, actorId);
  return data as Interview;
}

export async function deleteInterview(id: string): Promise<{ deleted: true }> {
  const { error } = await getSupabaseAdmin().from("interviews").delete().eq("id", id);
  if (error) throw new InterviewError(error.message, 500);
  return { deleted: true };
}

// ─── Follow-ups and the timeline ────────────────────────────────────────────

export async function listFollowups(interviewId: string): Promise<Followup[]> {
  return loadDealTasks({ interviewId });
}

export async function addFollowup(interviewId: string, input: {
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
}, actorId: string | null): Promise<Followup> {
  if (!input.title?.trim()) throw new InterviewError("A follow-up needs a title.");
  const interview = await getInterview(interviewId);
  if (!interview) throw new InterviewError("Interview not found.", 404);

  const task = await createDealTask({
    interview_id: interviewId,
    // Anchoring on the contact too means the task shows up against the person,
    // not only inside the interview it came from.
    contact_id: interview.contact_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assigned_to: input.assignedTo ?? null,
    due_at: input.dueAt ?? null,
  }, actorId ? { id: actorId } : undefined);

  await logEvent(interviewId, "followup_added", task.title, actorId);
  return task;
}

export async function setFollowupDone(id: string, done: boolean, actorId: string | null): Promise<Followup> {
  const task = await updateDealTask(id, { completed_at: done ? new Date().toISOString() : null });
  if (task.interview_id) {
    await logEvent(task.interview_id, done ? "followup_done" : "followup_reopened", task.title, actorId);
  }
  return task;
}

export async function listEvents(interviewId: string): Promise<InterviewEvent[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("interview_events").select("*").eq("interview_id", interviewId)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new InterviewError(error.message, 500);
  return (data ?? []) as InterviewEvent[];
}

/** Timeline entries are a side effect — a failure here must not fail the action. */
export async function logEvent(
  interviewId: string, kind: string, detail: string | null, actorId: string | null,
): Promise<void> {
  try {
    await getSupabaseAdmin().from("interview_events")
      .insert({ interview_id: interviewId, kind, detail, actor_id: actorId });
  } catch { /* the timeline is not worth failing a save over */ }
}
