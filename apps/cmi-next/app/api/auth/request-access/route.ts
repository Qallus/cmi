import { NextResponse } from "next/server";
import { sendRequestAccessEmail } from "@/lib/email/auth-emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public "request access" form on the staff login. Emails an admin — it never
// creates an account (the portal stays invite-only).
export async function POST(req: Request) {
  try {
    const { name, email, company, message } = (await req.json()) as {
      name?: string; email?: string; company?: string; message?: string;
    };
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const result = await sendRequestAccessEmail({
      name: name.trim(),
      email: email.trim(),
      company: company?.trim() || undefined,
      message: message?.trim() || undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not send your request." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not send your request." }, { status: 500 });
  }
}
