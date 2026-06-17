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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertVendor(supabase: ReturnType<typeof getSupabaseAdmin>, vendorName: string | null) {
  if (!vendorName) return null;
  const { data, error } = await supabase.from("selection_vendors").upsert({ name: vendorName }, { onConflict: "name" }).select("id").single();
  if (error) throw error;
  return data?.id || null;
}

function cleanProduct(input: Record<string, unknown>, vendorId: string | null) {
  const productName = text(input.product_name);
  if (!productName) throw new Error("Product name is required.");
  const availability = String(input.availability_status || "available");
  return {
    product_name: productName,
    product_slug: text(input.product_slug) || slugify(productName),
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
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false }).limit(250);
    if (error) throw error;
    return NextResponse.json({ products: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Products load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const input = await request.json();
    const vendorId = await upsertVendor(supabase, text(input.vendor_name));
    const payload = cleanProduct(input, vendorId);
    const { data, error } = await supabase.from("products").insert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json({ product: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Product create failed." }, { status: 400 });
  }
}
