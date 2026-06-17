import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SESSION_COOKIE = "cmi-session";
const COOKIE_MAX_AGE = 60 * 60 * 8;

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json() as { access_token?: string };

    if (!access_token) {
      return NextResponse.json({ error: "No token provided." }, { status: 400 });
    }

    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(access_token);
    if (error || !user) {
      return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 401 });
    }

    const { data: staff } = await getSupabaseAdmin()
      .from("staff_users")
      .select("id, first_name, last_name, display_name, role_slug, status")
      .eq("email", user.email ?? "")
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "No staff record found. Contact your administrator." }, { status: 403 });
    }

    // Activate invited users on first login
    if (staff.status === "invited" || staff.status === "pending") {
      await getSupabaseAdmin()
        .from("staff_users")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", staff.id);
    }

    const response = NextResponse.json({
      ok: true,
      role: staff.role_slug,
      first_name: staff.first_name ?? "",
      last_name: staff.last_name ?? "",
      display_name: staff.display_name ?? "",
    });

    response.cookies.set(SESSION_COOKIE, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Token exchange failed." }, { status: 500 });
  }
}
