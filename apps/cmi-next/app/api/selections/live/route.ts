import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
function numberOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return String(v || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

// Create a Selection from the Live/Manual builder. Writes the core record plus
// reusable association rows so the same Selection can be attached to multiple
// jobs / projects / tasks.
export async function POST(req: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const b = (await req.json()) as Record<string, unknown>;
    const name = text(b.title) || text(b.name);
    if (!name) return NextResponse.json({ error: "Product title is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Resolve vendor (by id, or upsert by name).
    let vendorId = text(b.vendor_id);
    const vendorName = text(b.vendor_name);
    if (!vendorId && vendorName) {
      const { data: v } = await supabase
        .from("selection_vendors")
        .upsert({ name: vendorName }, { onConflict: "name" })
        .select("id")
        .single();
      vendorId = v?.id ?? null;
    }

    const jobId = text(b.job_id);
    const projectId = text(b.project_id);
    const taskId = text(b.task_id);

    const metadata = {
      price_type: text(b.price_type),
      currency: text(b.currency),
      subcategory: text(b.subcategory),
      finish: text(b.finish),
      color: text(b.color),
      material: text(b.material),
      dimensions: text(b.dimensions),
      availability: text(b.availability),
      features: list(b.features),
      exterior_colors: list(b.exterior_colors),
      interior_colors: list(b.interior_colors),
      tags: list(b.tags),
      client_notes: text(b.client_notes),
      required: Boolean(b.required),
    };

    const row = {
      name,
      custom_product_name: name,
      category: text(b.category),
      manufacturer: text(b.manufacturer),
      sku: text(b.sku),
      model_number: text(b.model_number),
      description: text(b.short_description) || text(b.description),
      image_url: text(b.image_url),
      gallery_urls: list(b.gallery_urls),
      product_url: text(b.product_url) || text(b.source_url),
      vendor_id: vendorId,
      vendor_name: vendorName,
      quantity: numberOrNull(b.quantity) ?? 1,
      unit: text(b.unit),
      price: numberOrNull(b.price),
      estimated_cost: numberOrNull(b.price),
      lead_time_days: numberOrNull(b.lead_time_days),
      selection_status: text(b.status) || "draft",
      status: "pending",
      client_visible: Boolean(b.client_visible),
      internal_notes: text(b.creator_notes),
      client_comments: text(b.client_notes),
      job_id: jobId,
      project_id: projectId,
      related_task_id: taskId,
      source_type: "live",
      source_url: text(b.source_url),
      created_by: staff.id,
      metadata,
    };

    const { data: selection, error } = await supabase.from("project_selections").insert(row).select("*").single();
    if (error) throw new Error(error.message);

    // Reusable association (only when attached to a job/project/task). The
    // unique index is expression-based, so we insert and ignore duplicate-key.
    if (jobId || projectId || taskId) {
      const { error: assocErr } = await supabase
        .from("selection_associations")
        .insert({ selection_id: selection.id, job_id: jobId, project_id: projectId, task_id: taskId, created_by: staff.id });
      if (assocErr && assocErr.code !== "23505") {
        console.error("[selections/live] association error:", assocErr.message);
      }
    }

    await supabase.from("selection_activity").insert({
      selection_id: selection.id,
      user_id: staff.id,
      action: "selection.created",
      description: `Selection created via ${row.source_type === "live" ? "Live" : "Manual"} builder.`,
      metadata: { source_url: row.source_url, vendor_name: vendorName },
    });

    return NextResponse.json({ selection });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create selection." }, { status: 400 });
  }
}
