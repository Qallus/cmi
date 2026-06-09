export type ContactType = "Client" | "Lead" | "Vendor" | "Sub Contractor";
export type ContactStatus = "active" | "inactive" | "archived";

export type Contact = {
  id: string;
  fluent_crm_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  type: ContactType | null;
  status: ContactStatus | string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  tags: string[] | null;
  source: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactDraft = Omit<Contact, "id" | "fluent_crm_id" | "created_at" | "updated_at" | "last_activity">;
