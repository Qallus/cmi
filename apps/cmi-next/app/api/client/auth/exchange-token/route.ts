// Invite acceptance: the client clicks the emailed link (which carries a Supabase
// access token), we verify it maps to a portal-enabled contact, and set the
// cmi-client-session cookie so they can set a password + enter the portal.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-portal/auth";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json() as { access_token?: string };
    if (!access_token) return NextResponse.json({ error: "No token provided." }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data: { user }, error } = await sb.auth.getUser(access_token);
    if (error || !user?.email) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 401 });

    const { data: contact } = await sb.from("contacts").select("id, first_name").eq("email", user.email).maybeSingle();
    if (!contact) return NextResponse.json({ error: "No project access for this account." }, { status: 403 });

    const res = NextResponse.json({ ok: true, first_name: contact.first_name ?? "" });
    res.cookies.set(CLIENT_SESSION_COOKIE, access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: MAX_AGE, path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Could not verify invite." }, { status: 500 });
  }
}
