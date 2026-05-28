import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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

function legacyStatus(selectionStatus: string, procurementStatus: string) {
  if (selectionStatus === "approved_internally" || selectionStatus === "client_approved") return "approved";
  if (selectionStatus === "needs_review") return "needs_review";
  if (selectionStatus === "rejected_needs_revision") return "rejected";
  if (selectionStatus === "delivered" || procurementStatus === "delivered") return "delivery";
  if (selectionStatus === "backordered" || procurementStatus === "backordered") return "out_of_stock";
  return "pending";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = await request.json();
    const supabase = getSupabaseAdmin();
    const selectionStatus = String(input.selection_status || "draft");
    const approvalStatus = String(input.approval_status || "not_required");
    const procurementStatus = String(input.procurement_status || "not_ordered");
    const installStatus = String(input.install_status || "not_ready");
    const name = text(input.name) || text(input.custom_product_name);
    if (!name) throw new Error("Selection name is required.");

    const { data, error } = await supabase
      .from("project_selections")
      .update({
        project_id: text(input.project_id),
        project_schedule_item_id: text(input.project_schedule_item_id) || text(input.related_task_id),
        project_name: text(input.project_name),
        client_id: text(input.client_id),
        client_name: text(input.client_name),
        room_area_name: text(input.room_area_name),
        category: text(input.category),
        name,
        product_id: text(input.product_id),
        custom_product_name: text(input.custom_product_name) || name,
        description: text(input.description),
        image_url: text(input.image_url),
        gallery_urls: textList(input.gallery_urls),
        video_url: text(input.video_url),
        spec_sheet_url: text(input.spec_sheet_url),
        product_url: text(input.product_url),
        vendor_id: text(input.vendor_id),
        vendor_name: text(input.vendor_name),
        subcontractor_id: text(input.subcontractor_id),
        subcontractor_name: text(input.subcontractor_name),
        designer_user_id: text(input.designer_user_id),
        designer_name: text(input.designer_name),
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
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("selection_activity").insert({
      selection_id: id,
      action: "selection.updated",
      description: "Selection updated from dashboard.",
      metadata: { selection_status: data.selection_status, approval_status: data.approval_status }
    });
    return NextResponse.json({ selection: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Selection update failed." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("project_selections").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Selection delete failed." }, { status: 400 });
  }
}
