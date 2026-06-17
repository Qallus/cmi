import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function parseCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.trim().slice(name.length + 1)) || null;
}

export async function POST(request: Request) {
  try {
    const token = parseCookie(request.headers.get("cookie") ?? "", "cmi-session");
    if (!token) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const { first_name, last_name, password } = await request.json() as {
      first_name?: string;
      last_name?: string;
      password?: string;
    };

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      const { error: pwError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, { password });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 400 });
      }
    }

    const display_name = [first_name, last_name].filter(Boolean).join(" ").trim();
    await getSupabaseAdmin()
      .from("staff_users")
      .update({
        ...(first_name ? { first_name } : {}),
        ...(last_name ? { last_name } : {}),
        ...(display_name ? { display_name } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("email", user.email ?? "");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Profile update failed." }, { status: 500 });
  }
}
