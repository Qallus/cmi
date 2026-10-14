// Punch lists: checklists attached to exactly one Pipeline deal, Pre-Con
// opportunity or Job. Client-safe types and constants.

export type PunchParentType = "deal" | "precon" | "job";
export type PunchPriority = "low" | "normal" | "high" | "urgent";

export const PUNCH_PRIORITIES: PunchPriority[] = ["low", "normal", "high", "urgent"];
export const PARENT_LABEL: Record<PunchParentType, string> = { deal: "Pipeline", precon: "Pre-Con", job: "Job" };

// Who may create and check off punch items: the whole internal team (the same
// roles that work Pipeline deals). Clients only ever see client-visible Job
// lists, read-only, in their portal.
export const PUNCH_WRITE_ROLES = [
  "super_admin", "admin", "project_manager", "estimator", "staff", "designer", "superintendent",
] as const;
export function canWritePunch(role: string | null | undefined): boolean {
  return !!role && (PUNCH_WRITE_ROLES as readonly string[]).includes(role);
}

export type PunchParent = { type: PunchParentType; id: string; label: string; href: string };

export type PunchItem = {
  id: string;
  list_id: string;
  title: string;
  notes: string | null;
  location: string | null;
  trade: string | null;
  priority: PunchPriority;
  assigned_to: string | null;
  assignee_name?: string | null;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type PunchList = {
  id: string;
  deal_id: string | null;
  opportunity_id: string | null;
  job_id: string | null;
  title: string;
  description: string | null;
  client_visible: boolean;
  template_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  items: PunchItem[];
  parent: PunchParent | null;
};

/** An item before it is saved (from a template, dictation, import or Bolt). */
export type PunchItemDraft = {
  title: string;
  notes?: string | null;
  location?: string | null;
  trade?: string | null;
  priority?: PunchPriority;
  assigned_to?: string | null;
  due_date?: string | null;
};

export type PunchTemplate = {
  id: string;            // "sys:<slug>" for built-ins, a uuid for saved ones
  name: string;
  category: string | null;
  description: string | null;
  items: PunchItemDraft[];
  is_system: boolean;
};

export function parentOf(list: Pick<PunchList, "deal_id" | "opportunity_id" | "job_id">): { type: PunchParentType; id: string } | null {
  if (list.job_id) return { type: "job", id: list.job_id };
  if (list.opportunity_id) return { type: "precon", id: list.opportunity_id };
  if (list.deal_id) return { type: "deal", id: list.deal_id };
  return null;
}

export const PARENT_COLUMN: Record<PunchParentType, "deal_id" | "opportunity_id" | "job_id"> = {
  deal: "deal_id", precon: "opportunity_id", job: "job_id",
};
