export type MeetingStatus =
  | "draft" | "processing" | "transcribed" | "reviewed"
  | "action_items_created" | "shared_with_client" | "archived";

export const MEETING_TYPES = [
  "in_person", "phone_call", "zoom", "microsoft_teams", "google_meet",
  "internal_staff", "client_meeting", "vendor_subcontractor", "design_planning",
  "project_kickoff", "site_walkthrough", "change_order", "final_review",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<string, string> = {
  in_person: "In-person", phone_call: "Phone call", zoom: "Zoom",
  microsoft_teams: "Microsoft Teams", google_meet: "Google Meet",
  internal_staff: "Internal staff", client_meeting: "Client meeting",
  vendor_subcontractor: "Vendor / subcontractor", design_planning: "Design / planning",
  project_kickoff: "Project kickoff", site_walkthrough: "Site walkthrough",
  change_order: "Change order", final_review: "Final review",
};

export type MeetingAttendee = { name: string; email?: string; role?: string };
export type MeetingActionItem = { id: string; text: string; done?: boolean };
export type RelatedRecord = { type: string; id: string; label?: string };

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
