import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SESSION_COOKIE = "cmi-session";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Use separate client instances: signInWithPassword stores the user JWT in the
    // client's memory, which would cause the subsequent staff_users query to run as
    // that user (blocked by RLS) instead of as service role.
    const authClient = getSupabaseAdmin();
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Fresh admin client — service role key, no user session, bypasses RLS
    const { data: staff } = await getSupabaseAdmin()
      .from("staff_users")
      .select("id, role_slug, status")
      .eq("email", email)
      .in("status", ["active", "invited"])
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "Access denied — not an active staff member." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Sign in failed." }, { status: 500 });
  }
}
