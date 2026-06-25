export type MeetingStatus =
  | "draft" | "processing" | "transcribed" | "reviewed"
  | "action_items_created" | "shared_with_client" | "archived";

export const MEETING_TYPES = [
  "client_meeting", "staff_notes", "project_notes", "brainstorming",
  "designer", "vendor", "client", "sub_contractor", "city_planner",
  "internal_staff", "vendor_subcontractor", "design_planning", "project_kickoff",
  "site_walkthrough", "change_order", "final_review",
  "in_person", "phone_call", "zoom", "microsoft_teams", "google_meet",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<string, string> = {
  client_meeting: "Client meeting", staff_notes: "Staff notes", project_notes: "Project notes",
  brainstorming: "Brainstorming", designer: "Designer", vendor: "Vendor", client: "Client",
  sub_contractor: "Sub-contractor", city_planner: "City planner",
  internal_staff: "Internal staff", vendor_subcontractor: "Vendor / subcontractor",
  design_planning: "Design / planning", project_kickoff: "Project kickoff",
  site_walkthrough: "Site walkthrough", change_order: "Change order", final_review: "Final review",
  in_person: "In-person", phone_call: "Phone call", zoom: "Zoom",
  microsoft_teams: "Microsoft Teams", google_meet: "Google Meet",
};

// Tailwind classes for the meeting-type highlight badge.
export const MEETING_TYPE_COLOR: Record<string, string> = {
  client_meeting: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  client: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  staff_notes: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  internal_staff: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  project_notes: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  project_kickoff: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  brainstorming: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  designer: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  design_planning: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  vendor: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  vendor_subcontractor: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  sub_contractor: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  city_planner: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  site_walkthrough: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  change_order: "bg-red-500/15 text-red-600 dark:text-red-400",
  final_review: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
};
export const typeColor = (t: string) => MEETING_TYPE_COLOR[t] || "bg-muted text-muted-foreground";

export type MeetingAttendee = { name: string; email?: string; role?: string };
export type MeetingActionItem = { id: string; text: string; done?: boolean };
export type RelatedRecord = { type: string; id: string; label?: string };
export type MeetingRecording = { id: string; path: string; filename: string; mime?: string; created_at?: string; transcript?: string };

export type Meeting = {
  id: string;
  title: string;
  meeting_type: string;
  status: MeetingStatus;
  meeting_date: string | null;
  duration_seconds: number | null;
  location: string | null;

  contact_id: string | null;
  project_item_id: string | null;
  quote_id: string | null;
  document_id: string | null;
  staff_user_id: string | null;
  related_records: RelatedRecord[];
  attendees: MeetingAttendee[];

  recording_bucket: string | null;
  recording_path: string | null;
  recording_filename: string | null;
  recording_mime: string | null;
  recordings: MeetingRecording[];
  image_url: string | null;
  attachments: { name: string; path: string; mime?: string }[];

  transcript: string | null;
  summary: string | null;
  action_items: MeetingActionItem[];
  ai_suggestions: string[];
  follow_up_notes: string | null;
  internal_notes: string | null;
  client_notes: string | null;
  client_visible: boolean;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined display info
  contact?: { first_name: string; last_name: string; email: string | null } | null;
  project?: { title: string } | null;
  creator?: { display_name: string | null } | null;
};

export type MeetingListItem = Omit<Meeting, "transcript">;

export type SaveMeetingPayload = Partial<Meeting>;
