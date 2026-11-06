// Client portal sign-in. Sets the SEPARATE cmi-client-session cookie (plus its
// refresh cookie) and only admits emails that map to a contact with active
// portal access.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findPortalContactByEmail } from "@/lib/client-portal/auth";
import { setClientSessionCookies } from "@/lib/client-portal/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    const addr = (email ?? "").trim();
    if (!addr || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.auth.signInWithPassword({ email: addr, password });
    if (error || !data.session) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    // Must be a contact with portal access on a portal-enabled job.
    const { contact, hasAccess } = await findPortalContactByEmail(addr);
    if (!contact) return NextResponse.json({ error: "No project access for this account." }, { status: 403 });
    if (!hasAccess) return NextResponse.json({ error: "No active project access for this account." }, { status: 403 });

    await sb.from("contacts").update({ portal_last_login_at: new Date().toISOString() }).eq("id", contact.id);

    const res = NextResponse.json({ ok: true });
    setClientSessionCookies(res, data.session.access_token, data.session.refresh_token);
    return res;
  } catch {
    return NextResponse.json({ error: "Sign in failed." }, { status: 500 });
  }
}
