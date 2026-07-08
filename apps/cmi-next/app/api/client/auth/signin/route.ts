// Client portal sign-in. Sets the SEPARATE cmi-client-session cookie and only
// admits emails that map to a contact with active portal access.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-portal/auth";

const MAX_AGE = 60 * 60 * 12; // 12 hours

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({ email, password });
    if (error || !data.session) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    // Must be a contact with portal access on a portal-enabled job.
    const sb = getSupabaseAdmin();
    const { data: contact } = await sb.from("contacts").select("id").eq("email", email).maybeSingle();
    if (!contact) return NextResponse.json({ error: "No project access for this account." }, { status: 403 });
    const { data: access } = await sb
      .from("job_contacts")
      .select("id, jobs!inner(client_portal_enabled)")
      .eq("contact_id", contact.id).eq("portal_access_enabled", true).eq("jobs.client_portal_enabled", true).limit(1);
    if (!access?.length) return NextResponse.json({ error: "No active project access for this account." }, { status: 403 });

    await sb.from("contacts").update({ portal_last_login_at: new Date().toISOString() }).eq("id", contact.id);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(CLIENT_SESSION_COOKIE, data.session.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: MAX_AGE, path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Sign in failed." }, { status: 500 });
  }
}
