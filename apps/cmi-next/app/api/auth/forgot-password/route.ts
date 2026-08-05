import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateRecoveryLink, sendPasswordResetEmail } from "@/lib/email/auth-emails";

// Staff password reset request. Always responds { ok: true } so the response
// never reveals which emails have accounts.
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const addr = (email ?? "").trim().toLowerCase();
    if (!addr) return NextResponse.json({ ok: true });

    // Only send to known staff accounts.
    const { data: staff } = await getSupabaseAdmin()
      .from("staff_users")
      .select("email")
      .eq("email", addr)
      .maybeSingle();

    if (staff) {
      const link = await generateRecoveryLink(addr, "/reset-password");
      if (link) await sendPasswordResetEmail(addr, link);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
