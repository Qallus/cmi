// Dashboard Review Notes — the leadership FAB capture tool.

export const NOTE_TYPES = ["edit", "bug", "idea", "question", "remove", "other"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  edit: "Edit", bug: "Bug", idea: "Idea", question: "Question", remove: "Remove", other: "Other",
};

export const NOTE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type NotePriority = (typeof NOTE_PRIORITIES)[number];

export const NOTE_STATUSES = ["open", "in_progress", "done", "archived"] as const;
export type DashboardNoteStatus = (typeof NOTE_STATUSES)[number];
export const NOTE_STATUS_LABELS: Record<DashboardNoteStatus, string> = {
  open: "Open", in_progress: "In Progress", done: "Done", archived: "Archived",
};

export type DashboardNote = {
  id: string;
  route: string | null;
  page_title: string | null;
  note: string;
  type: NoteType;
  priority: NotePriority;
  status: DashboardNoteStatus;
  created_by: string | null;
  created_by_name: string | null;
  recipient_emails: string[];
  read_by: string[];
  screenshot_url: string | null;
  shared: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = {
  route: string;
  page_title: string;
  note: string;
  type: NoteType;
  priority: NotePriority;
  recipient_emails: string[];
  screenshot_url: string | null;
};
