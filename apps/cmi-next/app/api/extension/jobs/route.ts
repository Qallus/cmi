import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExtensionAccess, ExtensionAuthError } from "@/lib/extension/require-extension-access";
import { corsHeaders, preflight } from "@/lib/extension/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// Searchable job list for the destination picker. ?q= filters by name/number.
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    await requireExtensionAccess(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("jobs")
      .select("id, job_number, job_name, full_address, status, cover_image_url")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(25);

    if (q) {
      const safe = q.replace(/[%,]/g, " ");
      query = query.or(`job_name.ilike.%${safe}%,job_number.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ jobs: data ?? [] }, { headers });
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500, headers });
  }
}
