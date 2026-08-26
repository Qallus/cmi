import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

function text(value: unknown) {
  const next = String(value || "").trim();
  return next || null;
}

function numberOrNull(value: unknown) {
  if (value === "" || value == null) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function textList(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}

async function upsertVendor(supabase: ReturnType<typeof getSupabaseAdmin>, vendorName: string | null) {
  if (!vendorName) return null;
  const { data, error } = await supabase.from("selection_vendors").upsert({ name: vendorName }, { onConflict: "name" }).select("id").single();
  if (error) throw error;
  return data?.id || null;
}

async function getProjectName(supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string | null, fallback: string | null) {
  if (!projectId) return fallback;
  const { data } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
  return data?.title || fallback;
}

async function getContactName(supabase: ReturnType<typeof getSupabaseAdmin>, contactId: string | null, fallback: string | null) {
  if (!contactId) return fallback;
  const { data } = await supabase.from("contacts").select("first_name,last_name,email,company").eq("id", contactId).maybeSingle();
  return [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() || data?.company || data?.email || fallback;
}

async function getStaffName(supabase: ReturnType<typeof getSupabaseAdmin>, staffId: string | null, fallback: string | null) {
  if (!staffId) return fallback;
  const { data } = await supabase.from("staff_users").select("display_name,email").eq("id", staffId).maybeSingle();
  return data?.display_name || data?.email || fallback;
}

function legacyStatus(selectionStatus: string, procurementStatus: string) {
  if (selectionStatus === "approved_internally" || selectionStatus === "client_approved") return "approved";
  if (selectionStatus === "needs_review") return "needs_review";
  if (selectionStatus === "rejected_needs_revision") return "rejected";
  if (selectionStatus === "delivered" || procurementStatus === "delivered") return "delivery";
  if (selectionStatus === "backordered" || procurementStatus === "backordered") return "out_of_stock";
  return "pending";
}

async function cleanSelection(supabase: ReturnType<typeof getSupabaseAdmin>, input: Record<string, unknown>) {
  const name = text(input.name) || text(input.selection_name) || text(input.custom_product_name);
  if (!name) throw new Error("Selection name is required.");
  const projectId = text(input.project_id);
  const projectName = await getProjectName(supabase, projectId, text(input.project_name));
  if (!projectId && !projectName) throw new Error("Project or project name is required.");
  const clientId = text(input.client_id);
  const vendorName = text(input.vendor_name);
  const vendorId = text(input.vendor_id) || await upsertVendor(supabase, vendorName);
  const subcontractorId = text(input.subcontractor_id);
  const designerUserId = text(input.designer_user_id);
  const selectionStatus = String(input.selection_status || "draft");
  const approvalStatus = String(input.approval_status || "not_required");
  const procurementStatus = String(input.procurement_status || "not_ordered");
  const installStatus = String(input.install_status || "not_ready");

  return {
    project_id: projectId,
    project_schedule_item_id: text(input.project_schedule_item_id) || text(input.related_task_id),
    project_name: projectName,
    client_id: clientId,
    client_name: await getContactName(supabase, clientId, text(input.client_name)),
    room_area_name: text(input.room_area_name),
    category: text(input.category),
    name,
    product_id: text(input.product_id),
    custom_product_name: text(input.custom_product_name) || name,
    description: text(input.description),
    size: text(input.size),
    finish: text(input.finish),
    colors: text(input.colors),
    image_url: text(input.image_url),
    gallery_urls: textList(input.gallery_urls),
    video_url: text(input.video_url),
    spec_sheet_url: text(input.spec_sheet_url),
    product_url: text(input.product_url),
    vendor_id: vendorId,
    vendor_name: vendorName,
    subcontractor_id: subcontractorId,
    subcontractor_name: await getContactName(supabase, subcontractorId, text(input.subcontractor_name)),
    designer_user_id: designerUserId,
    designer_name: await getStaffName(supabase, designerUserId, text(input.designer_name)),
    related_task_id: text(input.related_task_id),
    quote_id: text(input.quote_id),
    sow_id: text(input.sow_id),
    contract_id: text(input.contract_id),
    invoice_id: text(input.invoice_id),
    selection_status: selectionStatus,
    approval_status: approvalStatus,
    procurement_status: procurementStatus,
    install_status: installStatus,
    status: legacyStatus(selectionStatus, procurementStatus),
    client_visible: Boolean(input.client_visible),
    client_approval_required: Boolean(input.client_approval_required),
    client_approval_status: approvalStatus === "not_required" ? "not_sent" : approvalStatus === "approved_with_changes" ? "approved" : approvalStatus,
    client_comments: text(input.client_comments),
    quantity: numberOrNull(input.quantity) || 1,
    unit: text(input.unit),
    price: numberOrNull(input.client_price) || numberOrNull(input.estimated_cost),
    allowance_amount: numberOrNull(input.allowance_amount),
    estimated_cost: numberOrNull(input.estimated_cost),
    actual_cost: numberOrNull(input.actual_cost),
    client_price: numberOrNull(input.client_price),
    over_under_amount: numberOrNull(input.over_under_amount),
    markup_amount: numberOrNull(input.markup_amount),
    tax_amount: numberOrNull(input.tax_amount),
    total_amount: numberOrNull(input.total_amount),
    lead_time_days: numberOrNull(input.lead_time_days),
    target_decision_date: text(input.target_decision_date),
    target_order_date: text(input.target_order_date),
    target_delivery_date: text(input.target_delivery_date),
    target_install_date: text(input.target_install_date),
    delivery_date: text(input.target_delivery_date),
    internal_notes: text(input.internal_notes),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("project_selections").select("*").order("updated_at", { ascending: false }).limit(250);
    if (error) throw error;
    return NextResponse.json({ selections: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Selections load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const payload = await cleanSelection(supabase, await request.json());
    const { data, error } = await supabase.from("project_selections").insert(payload).select("*").single();
    if (error) throw error;
    await supabase.from("selection_activity").insert({
      selection_id: data.id,
      action: "selection.created",
      description: "Selection created from dashboard.",
      metadata: { project_name: data.project_name, selection_status: data.selection_status }
    });
    return NextResponse.json({ selection: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Selection create failed." }, { status: 400 });
  }
}
