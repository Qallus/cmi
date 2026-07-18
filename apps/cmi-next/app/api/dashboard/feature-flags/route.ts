// Admin feature-flag management (super_admin / admin only). GET lists all flags;
// PATCH toggles one. Clears the flag cache on write so changes take effect at
// once.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { clearFlagCache } from "@/lib/flags";

const ADMIN = ["super_admin", "admin"];

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { data, error } = await getSupabaseAdmin().from("feature_flags").select("*").order("key");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flags: data ?? [] });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { key?: string; enabled?: boolean } | null;
    if (!body?.key || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "key and enabled are required." }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("feature_flags")
      .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
      .eq("key", body.key)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    clearFlagCache();
    return NextResponse.json({ flag: data });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}
