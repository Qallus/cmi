export type ContactSubmissionStatus = "new" | "read" | "archived";

export interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  how_heard: string | null;
  subject: string;
  message: string;
  status: ContactSubmissionStatus;
  contact_id: string | null;
  submitted_at: string;
  created_at: string;
}
