export type SelectionStatus =
  | "draft"
  | "needs_review"
  | "pending_client_approval"
  | "client_approved"
  | "rejected_needs_revision"
  | "approved_internally"
  | "ordered"
  | "backordered"
  | "delivered"
  | "installed"
  | "canceled"
  | "replaced"
  | "completed";

export type SelectionApprovalStatus = "not_required" | "pending" | "approved" | "rejected" | "revision_requested" | "approved_with_changes";
export type ProcurementStatus = "not_ordered" | "quote_requested" | "quote_received" | "ready_to_order" | "ordered" | "backordered" | "partially_delivered" | "delivered" | "canceled";
export type InstallStatus = "not_ready" | "ready_for_install" | "scheduled" | "in_progress" | "installed" | "needs_correction" | "completed";
export type ProductAvailabilityStatus = "available" | "limited" | "out_of_stock" | "discontinued" | "special_order" | "unknown";

export type Product = {
  id: string;
  product_name: string;
  product_slug: string | null;
  category: string | null;
  product_type: string | null;
  brand: string | null;
  manufacturer: string | null;
  sku: string | null;
  model_number: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  description: string | null;
  image_url: string | null;
  gallery_urls: string[];
  video_url: string | null;
  spec_sheet_url: string | null;
  product_url: string | null;
  unit_cost: number | null;
  retail_price: number | null;
  markup_percent: number | null;
  lead_time_days: number | null;
  availability_status: ProductAvailabilityStatus;
  warranty_info: string | null;
  install_notes: string | null;
  internal_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjectSelection = {
  id: string;
  project_id: string | null;
  project_schedule_item_id: string | null;
  project_name: string | null;
  client_id: string | null;
  client_name: string | null;
  room_area_name: string | null;
  category: string | null;
  name: string;
  eyebrow?: string | null;
  manufacturer?: string | null;
  sku?: string | null;
  model_number?: string | null;
  size?: string | null;
  finish?: string | null;
  colors?: string | null;
  product_id: string | null;
  custom_product_name: string | null;
  description: string | null;
  long_description?: string | null;
  features?: string[] | null;
  price?: number | null;
  source_url?: string | null;
  source_type?: string | null;
  image_url: string | null;
  gallery_urls: string[];
  video_url: string | null;
  spec_sheet_url: string | null;
  product_url: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  subcontractor_id: string | null;
  subcontractor_name: string | null;
  designer_user_id: string | null;
  designer_name: string | null;
  related_task_id: string | null;
  quote_id: string | null;
  sow_id: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  selection_status: SelectionStatus;
  approval_status: SelectionApprovalStatus;
  procurement_status: ProcurementStatus;
  install_status: InstallStatus;
  client_visible: boolean;
  client_approval_required: boolean;
  client_comments: string | null;
  quantity: number;
  unit: string | null;
  allowance_amount: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  client_price: number | null;
  over_under_amount: number | null;
  markup_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  lead_time_days: number | null;
  target_decision_date: string | null;
  target_order_date: string | null;
  target_delivery_date: string | null;
  target_install_date: string | null;
  internal_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SelectionOption = {
  id: string;
  label: string;
  sublabel?: string | null;
};

export type SelectionsData = {
  products: Product[];
  selections: ProjectSelection[];
  projects: SelectionOption[];
  tasks: SelectionOption[];
  contacts: SelectionOption[];
  staffUsers: SelectionOption[];
  vendors: SelectionOption[];
  subcontractors: SelectionOption[];
};
