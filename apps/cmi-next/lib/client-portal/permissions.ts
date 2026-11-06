// Client-portal permission defaults. `job_contacts.permissions` only stores keys
// staff have touched, so every read goes through clientCan() to get one answer
// for "unset". Showcase content is on by default; money, approvals and
// submissions are opt-in. Shared by the portal (enforcement) and the staff
// checkboxes (display), so the two can't disagree.
import type { ClientPermissions } from "@/lib/jobs/types";

export type ClientPermKey = keyof ClientPermissions;

export const CLIENT_PERM_DEFAULTS: Record<ClientPermKey, boolean> = {
  schedule_phases: true,
  schedule_items: true,
  messages: true,
  files: true,
  photos: true,
  pm_phone: false,
  locked_selections: false,
  change_order_requests: false,
  warranty_claims: false,
  price_summary: false,
  remaining_invoice_balance: false,
  purchase_orders: false,
  invoices: false,
  job_costing_budget: false,
};

export function clientCan(perms: Record<string, boolean | undefined> | null | undefined, key: ClientPermKey): boolean {
  const v = perms?.[key];
  return typeof v === "boolean" ? v : CLIENT_PERM_DEFAULTS[key];
}

// Warranty requests are always allowed once the job is in warranty.
export function clientCanSubmitWarranty(perms: Record<string, boolean | undefined> | null | undefined, status: string | null): boolean {
  return status === "warranty" || clientCan(perms, "warranty_claims");
}

// Checkboxes shown on the staff side, grouped. Only keys the portal enforces.
export const CLIENT_PERM_GROUPS: { label: string; perms: { key: ClientPermKey; label: string }[] }[] = [
  {
    label: "Project",
    perms: [
      { key: "schedule_items", label: "Schedule" },
      { key: "schedule_phases", label: "Project phases" },
      { key: "photos", label: "Photos" },
      { key: "files", label: "Documents & files" },
      { key: "pm_phone", label: "PM phone number" },
    ],
  },
  {
    label: "Interaction",
    perms: [
      { key: "messages", label: "Messages" },
      { key: "locked_selections", label: "Selections (view & approve)" },
      { key: "warranty_claims", label: "Submit warranty requests" },
    ],
  },
  {
    label: "Financial",
    perms: [
      { key: "price_summary", label: "Price summary" },
      { key: "invoices", label: "Invoices" },
      { key: "remaining_invoice_balance", label: "Remaining balance" },
    ],
  },
];
