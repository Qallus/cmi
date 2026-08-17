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
  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Project intake
  project_budget: string | null;
  /** Free-text amount captured when project_budget === "Other". */
  budget_amount: string | null;
  project_status: string[];
  status: ContactSubmissionStatus;
  contact_id: string | null;
  submitted_at: string;
  created_at: string;
}
