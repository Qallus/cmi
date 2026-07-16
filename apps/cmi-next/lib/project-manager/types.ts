export type ScheduleItemType = "project" | "phase" | "task" | "milestone";
export type ScheduleStatus = "pending" | "scheduled" | "in_progress" | "waiting" | "delayed" | "blocked" | "needs_approval" | "complete" | "canceled";
export type SchedulePriority = "low" | "normal" | "high" | "urgent" | "critical" | "blocking_closeout";
export type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";

export type ProjectScheduleItem = {
  id: string;
  board_id: string | null;
  project_id: string | null;
  client_project_id: string | null;
  type: ScheduleItemType;
  project_title: string | null;
  title: string;
  phase: string | null;
  assignee: string | null;
  client: string | null;
  participants: string | null;
  dependencies: string | null;
  start_date: string;
  end_date: string;
  client_start_date: string | null;
  client_end_date: string | null;
  status: ScheduleStatus;
  priority: SchedulePriority | null;
  progress: number;
  notify: boolean;
  description: string | null;
  forms: string | null;
  punch: string | null;
  client_visible: boolean | null;
  internal_notes: string | null;
  is_blocked: boolean | null;
  blocker_reason: string | null;
  sort_order: number | null;
  visible_on_gantt: boolean | null;
  schedule_group_key: string | null;
  template_slug: string | null;
  template_name: string | null;
  duration_minutes: number | null;
  metadata: Record<string, unknown> | null;
  association_counts?: {
    selections: number;
    media: number;
    photos: number;
    videos: number;
    codes: number;
    billing: number;
    participants: number;
  };
};

export type ProjectScheduleDependency = {
  id: string;
  board_id: string | null;
  project_id: string | null;
  client_project_id: string | null;
  source_item_id: string;
  target_item_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  auto_shift: boolean;
  notes: string | null;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  suggested_duration_days: number;
  is_active: boolean;
};

export type ProjectTemplateTask = {
  id: string;
  template_id: string;
  phase_name: string;
  task_key: string;
  task_name: string;
  description: string | null;
  offset_days: number;
  duration_minutes: number;
  dependency_keys: string[];
  suggested_roles: string[];
  client_visible: boolean;
  priority: SchedulePriority;
  sort_order: number;
};

export type ProjectManagerData = {
  items: ProjectScheduleItem[];
  dependencies: ProjectScheduleDependency[];
  templates: ProjectTemplate[];
  templateTasks: ProjectTemplateTask[];
};
