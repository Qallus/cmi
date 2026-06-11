import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const callSid = String(form.get("CallSid") || "");
  const callStatus = String(form.get("CallStatus") || "");
  const from = String(form.get("From") || "");
  const to = String(form.get("To") || "");

  console.info("[twilio/voice/status]", { callSid, callStatus, from, to });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
