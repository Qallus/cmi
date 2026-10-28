export type ContactSubmissionStatus = "new" | "read" | "archived";
/** Which path on the contact page it came in on; "spam" is filtered out of the inbox. */
export type ContactSubmissionKind = "client" | "vendor_pitch" | "trade_partner" | "spam";

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
  kind?: ContactSubmissionKind;
  spam_reason?: string | null;
  contact_id: string | null;
  submitted_at: string;
  created_at: string;
}
