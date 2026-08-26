export type SessionInfo = {
  ok: true;
  user: { id: string; email: string };
  staff: { id: string; name: string; role: string };
  organization_id: string;
};

export type Job = {
  id: string;
  job_number: string | null;
  job_name: string | null;
  full_address: string | null;
  status: string | null;
  cover_image_url: string | null;
};

export type SelectionGroup = {
  id: string;
  name: string;
  category: string | null;
  job_id: string | null;
  sort_order: number;
};

export type CardDraft = {
  eyebrow: string;
  title: string;
  vendor_name: string;
  category: string;
  sku: string;
  model_number: string;
  price: string;
  price_unit: string;
  short_description: string;
  long_description: string;
  features: string; // newline-separated in the form
  image_url: string;
  source_url: string;
  staff_notes: string;
  visible_to_client: boolean;
  visible_to_contractor: boolean;
  visible_to_vendor: boolean;
};

export type Destination =
  | { kind: "library"; group: SelectionGroup | null }
  | { kind: "job"; job: Job | null; group: SelectionGroup | null };

export const EMPTY_DRAFT: CardDraft = {
  eyebrow: "",
  title: "",
  vendor_name: "",
  category: "",
  sku: "",
  model_number: "",
  price: "",
  price_unit: "each",
  short_description: "",
  long_description: "",
  features: "",
  image_url: "",
  source_url: "",
  staff_notes: "",
  visible_to_client: false,
  visible_to_contractor: false,
  visible_to_vendor: false,
};
