// CMI Multi-Schedule Builder — shared types + vocabularies.
// One Job has many Schedules; each Schedule has phases, items (tasks +
// milestones), participants, dependencies, baselines, and an activity trail.

export type ScheduleType =
  | "master" | "construction" | "pre_construction" | "design" | "engineering"
  | "permit" | "municipal" | "procurement" | "selections" | "vendor"
  | "subcontractor" | "delivery" | "inspection" | "project" | "room"
  | "phase" | "punch_list" | "closeout" | "warranty" | "internal" | "custom";

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  master: "Master", construction: "Construction", pre_construction: "Pre-Construction",
  design: "Design", engineering: "Engineering", permit: "Permit", municipal: "Municipal / HOA",
  procurement: "Procurement", selections: "Selections", vendor: "Vendor", subcontractor: "Subcontractor",
  delivery: "Delivery", inspection: "Inspection", project: "Project", room: "Room / Area",
  phase: "Phase", punch_list: "Punch List", closeout: "Closeout", warranty: "Warranty",
  internal: "Internal Staff", custom: "Custom",
};

export type ScheduleStatus = "active" | "on_hold" | "complete" | "archived";
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  active: "Active", on_hold: "On Hold", complete: "Complete", archived: "Archived",
};

export type ScheduleHealth = "on_track" | "watch" | "at_risk" | "delayed" | "critical";
export const HEALTH_LABELS: Record<ScheduleHealth, string> = {
  on_track: "On Track", watch: "Watch", at_risk: "At Risk", delayed: "Delayed", critical: "Critical",
};
export const HEALTH_TONE: Record<ScheduleHealth, "success" | "warning" | "danger" | "info" | "default"> = {
  on_track: "success", watch: "warning", at_risk: "warning", delayed: "danger", critical: "danger",
};

export type ItemStatus =
  | "not_started" | "ready" | "scheduled" | "confirmed" | "in_progress"
  | "waiting" | "waiting_client" | "waiting_vendor" | "waiting_material"
  | "waiting_inspection" | "delayed" | "blocked" | "at_risk" | "complete" | "cancelled";

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "Not Started", ready: "Ready", scheduled: "Scheduled", confirmed: "Confirmed",
  in_progress: "In Progress", waiting: "Waiting", waiting_client: "Waiting on Client",
  waiting_vendor: "Waiting on Vendor", waiting_material: "Waiting on Material",
  waiting_inspection: "Waiting on Inspection", delayed: "Delayed", blocked: "Blocked",
  at_risk: "At Risk", complete: "Complete", cancelled: "Cancelled",
};
// Semantic tone for status chips.
export const ITEM_STATUS_TONE: Record<ItemStatus, "success" | "warning" | "danger" | "info" | "default"> = {
  not_started: "default", ready: "info", scheduled: "info", confirmed: "info", in_progress: "info",
  waiting: "warning", waiting_client: "warning", waiting_vendor: "warning", waiting_material: "warning",
  waiting_inspection: "warning", delayed: "danger", blocked: "danger", at_risk: "warning",
  complete: "success", cancelled: "default",
};

export type SchedulePriority = "low" | "normal" | "high" | "urgent" | "critical";
export const PRIORITY_LABELS: Record<SchedulePriority, string> = {
  low: "Low", normal: "Normal", high: "High", urgent: "Urgent", critical: "Critical",
};

export type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  finish_to_start: "Finish → Start", start_to_start: "Start → Start",
  finish_to_finish: "Finish → Finish", start_to_finish: "Start → Finish",
};
export const DEPENDENCY_ABBR: Record<DependencyType, string> = {
  finish_to_start: "FS", start_to_start: "SS", finish_to_finish: "FF", start_to_finish: "SF",
};

export type ScheduleView = "list" | "table" | "card" | "calendar" | "gantt" | "timeline" | "kanban" | "resource";

export type MasterDisplay = "inherit" | "do_not_show" | "milestone_only" | "show_when_critical" | "always_show";

export type Workdays = { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean };

export type Assignee = { id: string; name: string; type?: "staff" | "vendor" | "contractor" | "client" };

export type JobSchedule = {
  id: string;
  job_id: string;
  name: string;
  type: ScheduleType;
  description: string | null;
  owner_id: string | null;
  owner_name?: string | null;
  manager_id: string | null;
  manager_name?: string | null;
  start_date: string | null;
  target_completion: string | null;
  projected_completion: string | null;
  status: ScheduleStatus;
  priority: SchedulePriority;
  progress: number;
  health: ScheduleHealth;
  is_master: boolean;
  visibility: string;
  workdays: Workdays;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Aggregates (decorated):
  item_count?: number;
  milestone_count?: number;
  overdue_count?: number;
};

export type SchedulePhase = {
  id: string;
  schedule_id: string;
  name: string;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  progress: number;
  visibility: string;
  health: string | null;
  color: string | null;
  collapsed: boolean;
  sort_order: number;
};

export type ScheduleItem = {
  id: string;
  schedule_id: string;
  phase_id: string | null;
  job_id: string | null;
  kind: "task" | "milestone";
  title: string;
  description: string | null;
  status: ItemStatus;
  priority: SchedulePriority;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  duration_days: number | null;
  percent_complete: number;
  assignees: Assignee[];
  responsible_company: string | null;
  client_visible: boolean;
  confirmation_required: boolean;
  tags: string[];
  location: string | null;
  internal_notes: string | null;
  client_notes: string | null;
  is_critical: boolean;
  is_locked: boolean;
  baseline_start: string | null;
  baseline_end: string | null;
  recurrence: Record<string, unknown> | null;
  relationships: Record<string, unknown>;
  milestone_kind: string | null;
  master_display: MasterDisplay;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // decorated:
  schedule_name?: string;
  schedule_type?: ScheduleType;
  schedule_color?: string | null;
};

export type ScheduleDependency = {
  id: string;
  job_id: string | null;
  source_item_id: string;
  target_item_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  is_cross_schedule: boolean;
  auto_cascade: boolean;
  is_locked: boolean;
  notes: string | null;
};

export type ScheduleParticipant = {
  id: string;
  schedule_id: string;
  party_type: string;
  staff_id: string | null;
  contact_id: string | null;
  name: string | null;
  role: string | null;
  can_confirm: boolean;
  confirmation_status: string | null;
  confirmation_at: string | null;
};

export type ScheduleBaseline = {
  id: string;
  schedule_id: string;
  name: string;
  snapshot: { item_id: string; start_date: string | null; end_date: string | null }[];
  reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  captured_by: string | null;
  created_at: string;
};

export type ScheduleActivity = {
  id: string;
  job_id: string | null;
  schedule_id: string | null;
  item_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export const DEFAULT_WORKDAYS: Workdays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };

// A blank schedule draft.
export type ScheduleDraft = {
  name: string;
  type: ScheduleType;
  description?: string | null;
  owner_id?: string | null;
  manager_id?: string | null;
  start_date?: string | null;
  target_completion?: string | null;
  status?: ScheduleStatus;
  priority?: SchedulePriority;
  is_master?: boolean;
  visibility?: string;
  workdays?: Workdays;
  color?: string | null;
};
