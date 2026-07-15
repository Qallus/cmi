export type QuoteStatus = "New" | "In Review" | "Quoted" | "Won" | "Lost";

export type Quote = {
  id: string;
  fluent_crm_id: number | null;
  lead_number: string | null;
  contact_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  project_type: string | null;
  location: string | null;
  sq_ft: number | null;
  budget_range: string | null;
  timeline: string | null;
  services: string[] | null;
  description: string | null;
  status: QuoteStatus;
  estimated_value: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteDraft = Omit<Quote, "id" | "fluent_crm_id" | "lead_number" | "created_at" | "updated_at">;
