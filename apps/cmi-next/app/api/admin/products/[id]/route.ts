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

async function upsertVendor(supabase: ReturnType<typeof getSupabaseAdmin>, vendorName: string | null) {
  if (!vendorName) return null;
  const { data, error } = await supabase.from("selection_vendors").upsert({ name: vendorName }, { onConflict: "name" }).select("id").single();
  if (error) throw error;
  return data?.id || null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const input = await request.json();
    const productName = text(input.product_name);
    if (!productName) throw new Error("Product name is required.");
    const vendorId = await upsertVendor(supabase, text(input.vendor_name));
    const availability = String(input.availability_status || "available");
    const { data, error } = await supabase
      .from("products")
      .update({
        product_name: productName,
        category: text(input.category),
        product_type: text(input.product_type),
        brand: text(input.brand),
        manufacturer: text(input.manufacturer),
        sku: text(input.sku),
        model_number: text(input.model_number),
        vendor_id: vendorId,
        vendor_name: text(input.vendor_name),
        description: text(input.description),
        image_url: text(input.image_url),
        gallery_urls: textList(input.gallery_urls),
        video_url: text(input.video_url),
        spec_sheet_url: text(input.spec_sheet_url),
        product_url: text(input.product_url),
        unit_cost: numberOrNull(input.unit_cost),
        retail_price: numberOrNull(input.retail_price),
        markup_percent: numberOrNull(input.markup_percent),
        lead_time_days: numberOrNull(input.lead_time_days),
        availability_status: ["available", "limited", "out_of_stock", "discontinued", "special_order", "unknown"].includes(availability) ? availability : "available",
        warranty_info: text(input.warranty_info),
        install_notes: text(input.install_notes),
        internal_notes: text(input.internal_notes),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ product: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Product update failed." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Product delete failed." }, { status: 400 });
  }
}
