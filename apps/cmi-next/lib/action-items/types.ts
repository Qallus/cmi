export type ActionItemPriority = "low" | "normal" | "high" | "urgent";
export type ActionItemStatus = "open" | "in_progress" | "completed" | "dismissed";

export type ActionItem = {
  id: string;
  job_id: string;
  assigned_contact_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assigned_contact?: { first_name: string | null; last_name: string | null } | null;
};

export type ActionItemDraft = Partial<Omit<ActionItem, "id" | "created_at" | "updated_at" | "assigned_contact">> & { title: string };

export const ACTION_PRIORITIES: ActionItemPriority[] = ["low", "normal", "high", "urgent"];
export const ACTION_STATUSES: ActionItemStatus[] = ["open", "in_progress", "completed", "dismissed"];
