import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExtensionAccess, ExtensionAuthError } from "@/lib/extension/require-extension-access";
import { corsHeaders, preflight } from "@/lib/extension/cors";
import { reqStr, optStr, optNum, optBool, strList, optUuid, ValidationError } from "@/lib/extension/validate";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// Create a Selection Card from the extension. Writes into the existing
// project_selections record (the card the whole Selections system already uses),
// plus a reusable association row when attached to a job/project/task.
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    const ctx = await requireExtensionAccess(request);
    const b = (await request.json()) as Record<string, unknown>;

    const title = reqStr(b.title ?? b.name, "Product title", 500);
    const jobId = optUuid(b.job_id, "job_id");
    const projectId = optUuid(b.project_id, "project_id");
    const taskId = optUuid(b.task_id, "related_task_id");
    const groupId = optUuid(b.selection_group_id, "selection_group_id");
    const features = strList(b.features);

    const supabase = getSupabaseAdmin();

    // Resolve vendor by id, or upsert by name.
    let vendorId = optUuid(b.vendor_id, "vendor_id");
    const vendorName = optStr(b.vendor_name, 200);
    if (!vendorId && vendorName) {
      const { data: v } = await supabase
        .from("selection_vendors")
        .upsert({ name: vendorName }, { onConflict: "name" })
        .select("id")
        .single();
      vendorId = v?.id ?? null;
    }

    const captureMeta = {
      method: optStr(b.capture_method) ?? "manual",
      extension_version: optStr(b.extension_version),
      selectors: b.selectors && typeof b.selectors === "object" ? b.selectors : {},
      captured_at: new Date().toISOString(),
    };

    const shortDescription = optStr(b.short_description) ?? optStr(b.description);
    const longDescription = optStr(b.long_description);

    const row = {
      name: title,
      custom_product_name: title,
      eyebrow: optStr(b.eyebrow, 200),
      category: optStr(b.category, 120),
      manufacturer: optStr(b.manufacturer, 200),
      sku: optStr(b.sku, 200),
      model_number: optStr(b.model_number, 200),
      size: optStr(b.size, 200),
      finish: optStr(b.finish, 200),
      colors: optStr(b.colors, 400),
      description: shortDescription,
      long_description: longDescription,
      features,
      image_url: optStr(b.image_url ?? b.featured_image_path, 4000),
      gallery_urls: strList(b.gallery_urls ?? b.gallery, 8, 4000),
      product_url: optStr(b.product_url) ?? optStr(b.source_url, 4000),
      vendor_id: vendorId,
      vendor_name: vendorName,
      quantity: optNum(b.quantity) ?? 1,
      unit: optStr(b.price_unit ?? b.unit, 40),
      price: optNum(b.price),
      estimated_cost: optNum(b.price),
      selection_status: optStr(b.status) ?? "draft",
      status: "pending",
      client_visible: optBool(b.visible_to_client ?? b.client_visible),
      visible_to_contractor: optBool(b.visible_to_contractor),
      visible_to_vendor: optBool(b.visible_to_vendor),
      internal_notes: optStr(b.staff_notes ?? b.creator_notes),
      job_id: jobId,
      project_id: projectId,
      related_task_id: taskId,
      selection_group_id: groupId,
      source_type: "extension",
      source_url: optStr(b.source_url, 4000),
      created_by: ctx.staff.id,
      capture_meta: captureMeta,
      // Keep features in metadata too so the existing dashboard UI still renders them.
      metadata: { features },
    };

    const { data: card, error } = await supabase
      .from("project_selections")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;

    if (jobId || projectId || taskId) {
      const { error: assocErr } = await supabase
        .from("selection_associations")
        .insert({ selection_id: card.id, job_id: jobId, project_id: projectId, task_id: taskId, created_by: ctx.staff.id });
      if (assocErr && assocErr.code !== "23505") {
        console.error("[extension/cards] association error:", assocErr.message);
      }
    }

    await supabase.from("selection_activity").insert({
      selection_id: card.id,
      user_id: ctx.staff.id,
      action: "selection.created",
      description: "Selection captured via Chrome extension.",
      metadata: { source_url: row.source_url, vendor_name: vendorName },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.constructedmatter.com").replace(/\/$/, "");
    return NextResponse.json(
      { card, dashboard_url: `${appUrl}/dashboard/selections?id=${card.id}` },
      { headers },
    );
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers });
    }
    return NextResponse.json({ error: "Failed to create card." }, { status: 500, headers });
  }
}
