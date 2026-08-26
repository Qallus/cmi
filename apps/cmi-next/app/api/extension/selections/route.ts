import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExtensionAccess, ExtensionAuthError } from "@/lib/extension/require-extension-access";
import { corsHeaders, preflight } from "@/lib/extension/cors";
import { reqStr, optStr, optUuid, ValidationError } from "@/lib/extension/validate";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// List selection groups (library folders / job selection sets) for the org.
// ?job_id= optionally scopes to one job.
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const ctx = await requireExtensionAccess(request);
    const jobId = new URL(request.url).searchParams.get("job_id");
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("selection_groups")
      .select("id, name, category, job_id, sort_order")
      .eq("organization_id", ctx.organizationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ groups: data ?? [] }, { headers });
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    return NextResponse.json({ error: "Failed to load selections." }, { status: 500, headers });
  }
}

// Create a selection group.
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    const ctx = await requireExtensionAccess(request);
    const body = (await request.json()) as Record<string, unknown>;
    const name = reqStr(body.name, "Group name", 200);
    const category = optStr(body.category, 100);
    const jobId = optUuid(body.job_id, "job_id");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("selection_groups")
      .insert({
        organization_id: ctx.organizationId,
        name,
        category,
        job_id: jobId,
        created_by: ctx.staff.id,
      })
      .select("id, name, category, job_id, sort_order")
      .single();
    if (error) throw error;
    return NextResponse.json({ group: data }, { headers });
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers });
    }
    return NextResponse.json({ error: "Failed to create selection." }, { status: 500, headers });
  }
}
