import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "admin"];

// Staff roster with each member's extension-access state. Admin-only.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!ADMIN_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();

    const { data: staffRows, error } = await supabase
      .from("staff_users")
      .select("id, first_name, last_name, display_name, email, role_slug, status")
      .in("status", ["active", "invited"])
      .order("first_name", { ascending: true });
    if (error) throw error;

    const { data: accessRows } = await supabase.from("extension_access").select("staff_user_id, enabled");
    const enabledById = new Map((accessRows ?? []).map((r) => [r.staff_user_id, r.enabled]));

    const members = (staffRows ?? []).map((s) => ({
      id: s.id,
      name: s.display_name || [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || s.email,
      email: s.email,
      role: s.role_slug,
      enabled: enabledById.get(s.id) ?? false,
    }));

    return NextResponse.json({ members });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed to load extension access." }, { status: 500 });
  }
}

// Grant or revoke a staff member's extension access.
export async function PATCH(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!ADMIN_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    const { staff_user_id, enabled } = (await request.json()) as { staff_user_id?: string; enabled?: boolean };
    if (!staff_user_id || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "staff_user_id and enabled are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetErr } = await supabase
      .from("staff_users")
      .select("organization_id")
      .eq("id", staff_user_id)
      .maybeSingle();
    if (targetErr || !target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const { error } = await supabase.from("extension_access").upsert(
      {
        staff_user_id,
        organization_id: target.organization_id,
        enabled,
        updated_by: staff.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_user_id" },
    );
    if (error) throw error;

    return NextResponse.json({ ok: true, staff_user_id, enabled });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed to update extension access." }, { status: 500 });
  }
}
