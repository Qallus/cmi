import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SESSION_COOKIE = "cmi-session";

function parseCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.trim().slice(name.length + 1)) || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE);
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { data: staff } = await supabase
      .from("staff_users")
      .select("id, first_name, last_name, display_name, role_slug, title, avatar_url")
      .eq("email", user.email ?? "")
      .in("status", ["active", "invited"])
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: staff?.display_name ?? user.email,
        first_name: staff?.first_name ?? "",
        last_name: staff?.last_name ?? "",
        initials: initials(staff?.first_name, staff?.last_name),
        role: staff?.role_slug ?? "viewer",
        title: staff?.title ?? "",
        avatar_url: staff?.avatar_url ?? null,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

function initials(first?: string, last?: string) {
  const f = (first ?? "").trim()[0] ?? "";
  const l = (last ?? "").trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}
