// Lightweight staff directory for selectors (any staff member can read it).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try { await requireAdmin(request); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const { data, error } = await getSupabaseAdmin()
    .from("staff_users")
    .select("id, display_name, email, role_slug")
    .in("status", ["active", "invited", "pending"])
    .order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staff = (data ?? []).map((s) => ({ id: s.id, label: s.display_name || s.email || "Staff", email: s.email ?? "", role: s.role_slug }));
  return NextResponse.json({ staff });
}
