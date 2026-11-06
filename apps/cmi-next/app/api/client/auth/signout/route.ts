import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-portal/auth";
import { clearClientSessionCookies } from "@/lib/client-portal/session";

function readCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) || null : null;
}

export async function POST(request: Request) {
  // Revoke the Supabase session too, so a copied refresh token stops working.
  const token = readCookie(request.headers.get("cookie") ?? "", CLIENT_SESSION_COOKIE);
  if (token) {
    try { await getSupabaseAdmin().auth.admin.signOut(token, "local"); } catch { /* clearing cookies is enough */ }
  }
  const res = NextResponse.json({ ok: true });
  clearClientSessionCookies(res);
  return res;
}
