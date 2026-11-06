import { NextResponse } from "next/server";
import { findPortalContactByEmail } from "@/lib/client-portal/auth";
import { generateRecoveryLink, sendPasswordResetEmail } from "@/lib/email/auth-emails";

// Client-portal password reset request. Always responds { ok: true } so it never
// reveals which emails have accounts. Only sends to contacts that actually have
// portal access to a portal-enabled job.
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const addr = (email ?? "").trim().toLowerCase();
    if (!addr) return NextResponse.json({ ok: true });

    const { hasAccess } = await findPortalContactByEmail(addr);
    if (hasAccess) {
      const link = await generateRecoveryLink(addr, "/client/reset-password");
      if (link) await sendPasswordResetEmail(addr, link);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
