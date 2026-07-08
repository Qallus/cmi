// Client sets their password after accepting an invite (authenticated by the
// cmi-client-session cookie set during exchange-token).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-portal/auth";

function parseCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.trim().slice(name.length + 1)) || null;
}

export async function POST(request: Request) {
  try {
    const token = parseCookie(request.headers.get("cookie") ?? "", CLIENT_SESSION_COOKIE);
    if (!token) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const sb = getSupabaseAdmin();
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Session expired." }, { status: 401 });

    const { password } = await request.json() as { password?: string };
    if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const { error: pwErr } = await sb.auth.admin.updateUserById(user.id, { password });
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not set password." }, { status: 500 });
  }
}
