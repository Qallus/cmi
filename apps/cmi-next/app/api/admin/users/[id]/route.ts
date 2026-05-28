import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeUser } from "@/lib/users/data";
import type { UserInput, UserRole, UserStatus } from "@/lib/users/types";

const contactRoleTypes: Partial<Record<UserRole, "Client" | "Vendor" | "Sub Contractor" | "Lead">> = {
  client: "Client",
  vendor: "Vendor",
  subcontractor: "Sub Contractor"
};

async function canDisableUser(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data: user, error } = await supabase.from("staff_users").select("role_slug,status").eq("id", id).single();
  if (error) throw error;
  if (user.role_slug !== "super_admin") return true;

  const { count, error: countError } = await supabase
    .from("staff_users")
    .select("id", { count: "exact", head: true })
    .eq("role_slug", "super_admin")
    .in("status", ["active", "invited", "pending"])
    .neq("id", id);

  if (countError) throw countError;
  return Number(count || 0) > 0;
}

async function syncContact(supabase: ReturnType<typeof getSupabaseAdmin>, row: Record<string, unknown>, input: Partial<UserInput>) {
  const role = String(input.role_slug || row.role_slug || "viewer") as UserRole;
  const type = contactRoleTypes[role];
  const email = String(input.email || row.email || "").toLowerCase();
  if (!type || !email) return row.contact_id || null;

  const { data, error } = await supabase
    .from("contacts")
    .upsert({
      email,
      first_name: input.first_name ?? row.first_name ?? "",
      last_name: input.last_name ?? row.last_name ?? "",
      phone: input.phone ?? row.phone ?? null,
      company: input.company_name ?? row.company_name ?? null,
      type,
      status: input.status === "disabled" ? "disabled" : "active",
      source: "user-management",
      notes: input.notes ?? row.notes ?? null,
      last_activity: new Date().toISOString()
    }, { onConflict: "email" })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id || null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const action = String(body.action || "");

    const { data: existing, error: existingError } = await supabase.from("staff_users").select("*").eq("id", id).single();
    if (existingError) throw existingError;

    if ((action === "disable" || body.status === "disabled") && !(await canDisableUser(supabase, id))) {
      return NextResponse.json({ message: "The last Super Admin cannot be disabled." }, { status: 400 });
    }

    const nextStatus = action === "disable" ? "disabled" : action === "reactivate" ? "active" : body.status;
    const contactId = await syncContact(supabase, existing, body);
    const timestamp = new Date().toISOString();
    const patch = {
      contact_id: contactId,
      first_name: body.first_name ?? existing.first_name,
      last_name: body.last_name ?? existing.last_name,
      display_name: `${body.first_name ?? existing.first_name} ${body.last_name ?? existing.last_name}`.trim(),
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      role_slug: body.role_slug ?? existing.role_slug,
      status: (nextStatus ?? existing.status) as UserStatus,
      company_name: body.company_name ?? existing.company_name,
      title: body.job_title ?? existing.title,
      job_title: body.job_title ?? existing.job_title,
      avatar_url: body.avatar_url ?? existing.avatar_url,
      notes: body.notes ?? existing.notes,
      disabled_at: nextStatus === "disabled" ? timestamp : action === "reactivate" ? null : existing.disabled_at,
      updated_at: timestamp
    };

    const { data, error } = await supabase.from("staff_users").update(patch).eq("id", id).select("*").single();
    if (error) throw error;

    await supabase.from("user_activity_logs").insert({
      user_id: id,
      action: action || "user.updated",
      description: action === "disable" ? "User disabled." : action === "reactivate" ? "User reactivated." : "User profile updated.",
      metadata: { role_slug: patch.role_slug, status: patch.status, contact_id: contactId }
    });

    return NextResponse.json({ user: normalizeUser(data) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update user." }, { status: 400 });
  }
}
