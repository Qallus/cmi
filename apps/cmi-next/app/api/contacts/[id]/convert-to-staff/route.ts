import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const VALID_ROLES = ["admin", "project_manager", "designer", "estimator", "superintendent", "viewer"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json() as { role_slug?: string };

    const role_slug = body.role_slug ?? "viewer";
    if (!VALID_ROLES.includes(role_slug)) {
      return NextResponse.json({ error: "Invalid role_slug." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Load the contact
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (contactErr || !contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const email = contact.email as string;
    const first_name = (contact.first_name as string) ?? "";
    const last_name = (contact.last_name as string) ?? "";
    const display_name = [first_name, last_name].filter(Boolean).join(" ") || email;

    // Upsert into staff_users (status: invited — no auth user yet)
    const { error: staffErr } = await supabase
      .from("staff_users")
      .upsert({
        email,
        first_name,
        last_name,
        display_name,
        role_slug,
        status: "invited",
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });

    if (staffErr) {
      return NextResponse.json({ error: staffErr.message }, { status: 500 });
    }

    // Log in user_invites if the table exists
    await supabase.from("user_invites").insert({
      email,
      name: display_name,
      role_slug,
      contact_id: id,
      notify_email: false,
      notify_sms: false,
      invited_by_email: null,
    }).then(() => null).catch(() => null);

    // Update the contact type to Client (moved out of Leads)
    const { data: updatedContact, error: updateErr } = await supabase
      .from("contacts")
      .update({ type: "Client", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json(updatedContact);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
