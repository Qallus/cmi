// Invite acceptance / password reset: the client clicks the emailed link (which
// carries a Supabase access + refresh token), we verify it maps to a contact with
// portal access, and set the client session cookies so they can set a password
// and enter the portal.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findPortalContactByEmail } from "@/lib/client-portal/auth";
import { setClientSessionCookies } from "@/lib/client-portal/session";

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json() as { access_token?: string; refresh_token?: string };
    if (!access_token) return NextResponse.json({ error: "No token provided." }, { status: 400 });

    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(access_token);
    if (error || !user?.email) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 401 });

    const { contact, hasAccess } = await findPortalContactByEmail(user.email);
    if (!contact || !hasAccess) return NextResponse.json({ error: "No active project access for this account." }, { status: 403 });

    const res = NextResponse.json({ ok: true, first_name: contact.first_name ?? "" });
    setClientSessionCookies(res, access_token, refresh_token);
    return res;
  } catch {
    return NextResponse.json({ error: "Could not verify invite." }, { status: 500 });
  }
}
