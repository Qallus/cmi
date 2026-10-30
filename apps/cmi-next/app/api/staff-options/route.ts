// Lightweight staff directory for selectors (any staff member can read it).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try { await requireAdmin(request); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const { data, error } = await getSupabaseAdmin()
    .from("staff_users")
    .select("*") // job_roles may not exist until the 2026-10-30 migration runs
    .in("status", ["active", "invited", "pending"])
    .order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staff = (data ?? []).map((s) => ({
    id: s.id, label: s.display_name || s.email || "Staff", email: s.email ?? "",
    role: s.role_slug, job_title: s.job_title || s.title || "",
    job_roles: Array.isArray(s.job_roles) ? (s.job_roles as string[]) : [],
  }));
  return NextResponse.json({ staff });
}
