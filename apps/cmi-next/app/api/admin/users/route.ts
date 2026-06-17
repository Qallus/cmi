import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { normalizeUser } from "@/lib/users/data";
import type { UserInput, UserRole } from "@/lib/users/types";

const contactRoleTypes: Partial<Record<UserRole, "Client" | "Vendor" | "Sub Contractor" | "Lead">> = {
  client: "Client",
  vendor: "Vendor",
  subcontractor: "Sub Contractor"
};

function cleanInput(input: Partial<UserInput>): UserInput {
  const first_name = String(input.first_name || "").trim();
  const last_name = String(input.last_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const role_slug = String(input.role_slug || "viewer") as UserInput["role_slug"];
  const status = String(input.status || (input.send_invite ? "invited" : "pending")) as UserInput["status"];

  if (!first_name) throw new Error("First name is required.");
  if (!last_name) throw new Error("Last name is required.");
  if (!email) throw new Error("Email is required.");
  if (!role_slug) throw new Error("Role is required.");

  return {
    first_name,
    last_name,
    email,
    role_slug,
    status,
    phone: String(input.phone || "").trim(),
    company_name: String(input.company_name || "").trim(),
    job_title: String(input.job_title || "").trim(),
    avatar_url: String(input.avatar_url || "").trim(),
    notes: String(input.notes || "").trim(),
    send_invite: Boolean(input.send_invite),
    notify_sms: Boolean(input.notify_sms)
  };
}

async function getOrganizationId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase.from("organizations").select("id").eq("slug", "constructed-matter").maybeSingle();
  return data?.id || null;
}

async function upsertContactForUser(supabase: ReturnType<typeof getSupabaseAdmin>, input: UserInput) {
  const type = contactRoleTypes[input.role_slug];
  if (!type) return null;

  const { data, error } = await supabase
    .from("contacts")
    .upsert({
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone || null,
      company: input.company_name || null,
      type,
      status: input.status === "disabled" ? "disabled" : "active",
      source: "user-management",
      notes: input.notes || null,
      last_activity: new Date().toISOString()
    }, { onConflict: "email" })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id || null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("staff_users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ users: (data || []).map(normalizeUser) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const input = cleanInput(await request.json());
    const organizationId = await getOrganizationId(supabase);
    const contactId = await upsertContactForUser(supabase, input);
    const timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("staff_users")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        display_name: `${input.first_name} ${input.last_name}`.trim(),
        phone: input.phone || null,
        title: input.job_title || null,
        job_title: input.job_title || null,
        company_name: input.company_name || null,
        avatar_url: input.avatar_url || null,
        role_slug: input.role_slug,
        status: input.send_invite ? "invited" : input.status,
        notes: input.notes || null,
        invited_at: input.send_invite ? timestamp : null,
        invite_email_sent_at: input.send_invite ? timestamp : null,
        invite_sms_sent_at: input.notify_sms ? timestamp : null
      })
      .select("*")
      .single();

    if (error) throw error;

    if (input.send_invite) {
      await supabase.from("user_invites").insert({
        email: input.email,
        phone: input.phone || null,
        name: `${input.first_name} ${input.last_name}`.trim(),
        role_slug: input.role_slug,
        contact_id: contactId,
        staff_user_id: data.id,
        notify_email: true,
        notify_sms: input.notify_sms,
        email_status: "queued",
        sms_status: input.notify_sms ? "queued" : null,
        invited_by_email: "dashboard"
      });
    }

    await supabase.from("user_activity_logs").insert({
      user_id: data.id,
      action: input.send_invite ? "invite.created" : "user.created",
      description: input.send_invite ? "User invite queued from dashboard." : "User created from dashboard.",
      metadata: { role_slug: input.role_slug, contact_id: contactId }
    });

    return NextResponse.json({ user: normalizeUser(data) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not create user." }, { status: 400 });
  }
}
