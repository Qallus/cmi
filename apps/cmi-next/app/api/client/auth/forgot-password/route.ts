import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateRecoveryLink, sendPasswordResetEmail } from "@/lib/email/auth-emails";

// Client-portal password reset request. Always responds { ok: true } so it never
// reveals which emails have accounts. Only sends to contacts that actually have
// portal access to a portal-enabled job.
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const addr = (email ?? "").trim().toLowerCase();
    if (!addr) return NextResponse.json({ ok: true });

    const sb = getSupabaseAdmin();
    const { data: contact } = await sb.from("contacts").select("id").eq("email", addr).maybeSingle();
    if (contact) {
      const { data: access } = await sb
        .from("job_contacts")
        .select("job_id, jobs!inner(client_portal_enabled)")
        .eq("contact_id", contact.id)
        .eq("portal_access_enabled", true)
        .eq("jobs.client_portal_enabled", true)
        .limit(1);
      if ((access?.length ?? 0) > 0) {
        const link = await generateRecoveryLink(addr, "/client/reset-password");
        if (link) await sendPasswordResetEmail(addr, link);
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
