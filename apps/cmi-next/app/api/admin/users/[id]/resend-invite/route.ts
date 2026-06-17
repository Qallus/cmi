import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { normalizeUser } from "@/lib/users/data";
import { generateInviteLink, sendInviteEmail } from "@/lib/email/invite";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
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

    let emailStatus = "failed";
    const inviteLink = await generateInviteLink(user.email);
    if (inviteLink) {
      const result = await sendInviteEmail({
        email: user.email,
        firstName: user.first_name ?? user.display_name ?? "there",
        roleSlug: user.role_slug,
        inviteLink,
      });
      emailStatus = result.ok ? "sent" : "failed";
    }

    await supabase.from("user_invites").insert({
      email: user.email,
      phone: user.phone,
      name: user.display_name,
      role_slug: user.role_slug,
      contact_id: user.contact_id,
      staff_user_id: user.id,
      notify_email: true,
      notify_sms: false,
      email_status: emailStatus,
      invited_by_email: "dashboard"
    });

    await supabase.from("user_activity_logs").insert({
      user_id: id,
      action: "invite.resent",
      description: emailStatus === "sent" ? "Invite email resent successfully." : "Invite resent but email delivery failed — check RESEND_API_KEY.",
      metadata: { role_slug: user.role_slug, email_status: emailStatus }
    });

    if (emailStatus === "failed") {
      return NextResponse.json({ message: "User status updated but email failed to send. Check server logs." }, { status: 500 });
    }

    return NextResponse.json({ user: normalizeUser(user) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not resend invite." }, { status: 400 });
  }
}
