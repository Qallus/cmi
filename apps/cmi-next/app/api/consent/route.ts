// Public opt-in / opt-out endpoint for the SMS & email consent pages. No auth.
import { NextResponse } from "next/server";
import { applyConsent, looksValid, type Channel, type ConsentAction } from "@/lib/messaging/consent";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    | { channel?: Channel; action?: ConsentAction; address?: string }
    | null;

  const channel = body?.channel;
  const action = body?.action;
  const address = String(body?.address || "").trim();

  if (channel !== "sms" && channel !== "email") return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  if (action !== "opt_in" && action !== "opt_out") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if (!looksValid(channel, address)) {
    return NextResponse.json({ error: channel === "email" ? "Enter a valid email address." : "Enter a valid phone number." }, { status: 400 });
  }

  const result = await applyConsent({ channel, action, address, source: "public_page" });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
