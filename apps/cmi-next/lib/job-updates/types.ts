export type UpdateVisibility = "internal" | "client_visible" | "team";

export type JobUpdateMedia = { url: string; type: "image" | "video"; name?: string };

export type JobUpdate = {
  id: string;
  job_id: string;
  title: string;
  body: string | null;
  update_type: string | null;
  visibility: UpdateVisibility;
  photo_url: string | null;
  media: JobUpdateMedia[];
  posted_by: string | null;
  client_action_required: boolean;
  created_at: string;
  updated_at: string;
};

export type JobUpdateDraft = Partial<Omit<JobUpdate, "id" | "created_at" | "updated_at">> & { title: string };

export const UPDATE_TYPES = [
  "general", "schedule", "daily_log_summary", "site_visit", "photo_update", "selection_reminder",
  "change_order", "permit", "inspection", "delay_notice", "action_needed", "warranty",
] as const;
