// Turns the selection editor's form values (all strings, "" for empty) into a
// project_selections row patch: numbers become numbers or null, URL lists
// become arrays, blanks become null. Only fields present in the input are
// written, so a partial save never clears columns the form doesn't carry
// (quote / SOW / contract / invoice links, job_id).

const TEXT = [
  "project_id", "project_name", "client_id", "client_name", "room_area_name", "category", "product_id",
  "custom_product_name", "description", "size", "finish", "colors", "image_url", "video_url", "spec_sheet_url",
  "product_url", "vendor_id", "vendor_name", "subcontractor_id", "subcontractor_name", "designer_user_id",
  "designer_name", "related_task_id", "unit", "target_decision_date", "target_order_date", "target_delivery_date",
  "target_install_date", "client_comments", "internal_notes",
  // Captured by the Chrome extension too.
  "eyebrow", "manufacturer", "sku", "model_number", "long_description", "source_url", "selection_group_id",
] as const;
/** Fields the Chrome extension captures that the older dashboard forms didn't carry. */
export const EXTENSION_FIELDS = ["eyebrow", "manufacturer", "sku", "model_number", "long_description", "features", "source_url", "selection_group_id", "visible_to_contractor", "visible_to_vendor"] as const;
const NUMBER = ["allowance_amount", "estimated_cost", "actual_cost", "client_price", "lead_time_days"] as const;

function text(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return String(value ?? "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

/** The legacy single `status` column, kept in step with the newer status fields. */
export function legacySelectionStatus(selectionStatus: string, procurementStatus: string): string {
  if (selectionStatus === "approved_internally" || selectionStatus === "client_approved") return "approved";
  if (selectionStatus === "needs_review") return "needs_review";
  if (selectionStatus === "rejected_needs_revision") return "rejected";
  if (selectionStatus === "delivered" || procurementStatus === "delivered") return "delivery";
  if (selectionStatus === "backordered" || procurementStatus === "backordered") return "out_of_stock";
  return "pending";
}

/** Just the extension-captured fields that were sent, for routes that build the rest of the row themselves. */
export function extensionFieldsFromInput(input: Record<string, unknown>): Record<string, unknown> {
  const all = selectionPatchFromInput(input);
  return Object.fromEntries(Object.entries(all).filter(([k]) => (EXTENSION_FIELDS as readonly string[]).includes(k)));
}

export function selectionPatchFromInput(input: Record<string, unknown>): Record<string, unknown> {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  const out: Record<string, unknown> = {};
  for (const key of TEXT) if (has(key)) out[key] = text(input[key]);
  for (const key of NUMBER) if (has(key)) out[key] = numberOrNull(input[key]);
  if (has("gallery_urls")) out.gallery_urls = textList(input.gallery_urls);
  // One feature per line (a feature can contain commas).
  if (has("features")) out.features = Array.isArray(input.features) ? textList(input.features) : String(input.features ?? "").split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  if (has("visible_to_contractor")) out.visible_to_contractor = Boolean(input.visible_to_contractor);
  if (has("visible_to_vendor")) out.visible_to_vendor = Boolean(input.visible_to_vendor);
  if (has("quantity")) out.quantity = numberOrNull(input.quantity) || 1;
  if (has("client_visible")) out.client_visible = Boolean(input.client_visible);
  if (has("client_approval_required")) out.client_approval_required = Boolean(input.client_approval_required);

  if (has("name") || has("custom_product_name")) {
    const name = text(input.name) || text(input.custom_product_name);
    if (name) out.name = name;
    if (has("custom_product_name")) out.custom_product_name = text(input.custom_product_name) || name;
  }
  // The task link is stored twice (newer related_task_id, older project_schedule_item_id).
  if (has("related_task_id")) out.project_schedule_item_id = text(input.related_task_id);
  if (has("target_delivery_date")) out.delivery_date = text(input.target_delivery_date);
  if (has("client_price") || has("estimated_cost")) out.price = numberOrNull(input.client_price) || numberOrNull(input.estimated_cost);

  for (const key of ["selection_status", "approval_status", "procurement_status", "install_status"] as const) {
    if (has(key) && text(input[key])) out[key] = text(input[key]);
  }
  if (has("selection_status") || has("procurement_status")) {
    out.status = legacySelectionStatus(String(input.selection_status || "draft"), String(input.procurement_status || "not_ordered"));
  }
  if (has("approval_status")) {
    const a = String(input.approval_status || "not_required");
    out.client_approval_status = a === "not_required" ? "not_sent" : a === "approved_with_changes" ? "approved" : a;
  }
  return out;
}
