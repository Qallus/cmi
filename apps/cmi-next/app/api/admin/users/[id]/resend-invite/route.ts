import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeUser } from "@/lib/users/data";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString();

    const { data: user, error: userError } = await supabase
      .from("staff_users")
      .update({ status: "invited", invited_at: timestamp, invite_email_sent_at: timestamp, updated_at: timestamp })
      .eq("id", id)
      .select("*")
      .single();
    if (userError) throw userError;

    await supabase.from("user_invites").insert({
      email: user.email,
      phone: user.phone,
      name: user.display_name,
      role_slug: user.role_slug,
      contact_id: user.contact_id,
      staff_user_id: user.id,
      notify_email: true,
      notify_sms: false,
      email_status: "queued",
      invited_by_email: "dashboard"
    });

    await supabase.from("user_activity_logs").insert({
      user_id: id,
      action: "invite.resent",
      description: "User invite resent from dashboard.",
      metadata: { role_slug: user.role_slug }
    });

    return NextResponse.json({ user: normalizeUser(user) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not resend invite." }, { status: 400 });
  }
}
