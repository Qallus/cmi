// The invite email exactly as this person would receive it, rendered as a page
// and not sent. The button points at a placeholder: a real invite link is a
// one-time sign-in token, so previewing never creates one.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { buildInviteHtml } from "@/lib/email/invite";
import { publicAppUrl } from "@/lib/twilio";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data: user } = await getSupabaseAdmin()
      .from("staff_users").select("first_name, display_name, role_slug").eq("id", id).maybeSingle();
    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });
    const html = buildInviteHtml(
      user.first_name ?? user.display_name ?? "there",
      user.role_slug,
      `${publicAppUrl()}/register?preview=invite-link-is-created-when-sent`,
    );
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Preview failed." }, { status: 500 });
  }
}
