export type ChangeOrderStatus = "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "void";

export type ChangeOrder = {
  id: string;
  job_id: string;
  co_number: string | null;
  title: string;
  description: string | null;
  status: ChangeOrderStatus;
  amount: number | null;
  co_date: string | null;
  approved_date: string | null;
  requested_by: string | null;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChangeOrderDraft = Partial<Omit<ChangeOrder, "id" | "co_number" | "created_at" | "updated_at">> & { title: string };

export const CHANGE_ORDER_STATUSES: ChangeOrderStatus[] = ["draft", "submitted", "pending_approval", "approved", "rejected", "void"];
