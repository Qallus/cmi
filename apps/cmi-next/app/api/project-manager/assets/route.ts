import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const mediaTypes = new Set(["photo", "video"]);
const captureSources = new Set(["upload", "front_camera", "rear_camera", "unknown"]);
const selectionStatuses = new Set(["pending", "available", "delivery", "out_of_stock", "discontinued", "approved", "rejected", "needs_review"]);
const approvalStatuses = new Set(["not_sent", "pending", "approved", "rejected", "revision_requested"]);
const jurisdictionTypes = new Set(["city", "county", "state", "federal", "hoa", "other"]);
const complianceStatuses = new Set(["not_reviewed", "applicable", "satisfied", "issue", "not_applicable"]);

function text(value: unknown) {
  const next = String(value || "").trim();
  return next || null;
}

function nullableUuid(value: unknown) {
  const next = text(value);
  return next || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const resource = String(body.resource || "");
    const projectId = nullableUuid(body.project_id);
    const itemId = nullableUuid(body.project_schedule_item_id);

    if (!projectId && !itemId) {
      throw new Error("A project or schedule item is required.");
    }

    if (resource === "media") {
      const mediaType = mediaTypes.has(String(body.media_type)) ? String(body.media_type) : "photo";
      const fileUrl = text(body.file_url);
      if (!fileUrl) throw new Error("Media URL is required until Supabase Storage upload is connected.");

      const payload = {
        project_id: projectId,
        project_schedule_item_id: itemId,
        media_type: mediaType,
        title: text(body.title),
        caption: text(body.caption),
        file_url: fileUrl,
        storage_bucket: text(body.storage_bucket),
        storage_path: text(body.storage_path),
        capture_source: captureSources.has(String(body.capture_source)) ? String(body.capture_source) : "unknown",
        client_visible: Boolean(body.client_visible),
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      };
      const { data, error } = await supabase.from("project_media").insert(payload).select().single();
      if (error) throw error;
      return NextResponse.json({ media: data });
    }

    if (resource === "selection") {
      const name = text(body.name);
      if (!name) throw new Error("Selection name is required.");
      const vendorName = text(body.vendor_name);
      let vendorId = nullableUuid(body.vendor_id);

      if (!vendorId && vendorName) {
        const { data: vendor, error: vendorError } = await supabase
          .from("selection_vendors")
          .upsert({ name: vendorName }, { onConflict: "name" })
          .select()
          .single();
        if (vendorError) throw vendorError;
        vendorId = vendor?.id || null;
      }

      const payload = {
        project_id: projectId,
        project_schedule_item_id: itemId,
        vendor_id: vendorId,
        vendor_name: vendorName,
        name,
        category: text(body.category),
        manufacturer: text(body.manufacturer),
        sku: text(body.sku),
        model_number: text(body.model_number),
        description: text(body.description),
        image_url: text(body.image_url),
        product_url: text(body.product_url),
        price: body.price === "" || body.price == null ? null : Number(body.price),
        quantity: body.quantity === "" || body.quantity == null ? 1 : Number(body.quantity),
        unit: text(body.unit),
        status: selectionStatuses.has(String(body.status)) ? String(body.status) : "pending",
        delivery_date: text(body.delivery_date),
        lead_time_days: body.lead_time_days === "" || body.lead_time_days == null ? null : Number(body.lead_time_days),
        client_approval_status: approvalStatuses.has(String(body.client_approval_status)) ? String(body.client_approval_status) : "not_sent",
        client_visible: Boolean(body.client_visible),
        internal_notes: text(body.internal_notes),
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      };
      const { data, error } = await supabase.from("project_selections").insert(payload).select().single();
      if (error) throw error;
      return NextResponse.json({ selection: data });
    }

    if (resource === "code_reference") {
      const title = text(body.title);
      if (!title) throw new Error("Code reference title is required.");
      const payload = {
        project_id: projectId,
        project_schedule_item_id: itemId,
        title,
        jurisdiction_type: jurisdictionTypes.has(String(body.jurisdiction_type)) ? String(body.jurisdiction_type) : "city",
        jurisdiction_name: text(body.jurisdiction_name),
        code_source: text(body.code_source),
        code_section: text(body.code_section),
        code_text: text(body.code_text),
        source_url: text(body.source_url),
        applies_to_phase: text(body.applies_to_phase),
        required_inspection: text(body.required_inspection),
        compliance_status: complianceStatuses.has(String(body.compliance_status)) ? String(body.compliance_status) : "not_reviewed",
        notes: text(body.notes),
        client_visible: Boolean(body.client_visible),
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      };
      const { data, error } = await supabase.from("project_code_references").insert(payload).select().single();
      if (error) throw error;
      return NextResponse.json({ codeReference: data });
    }

    throw new Error("Unsupported project asset type.");
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Project asset save failed" }, { status: 500 });
  }
}
