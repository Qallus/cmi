import { NextResponse } from "next/server";
import { logMessage } from "@/lib/communications/data";
import type { SendEmailPayload, SendSmsPayload } from "@/lib/communications/types";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { channel: "email" | "sms" } & (SendEmailPayload | SendSmsPayload);
    const { channel } = body;

    if (channel === "email") {
      const payload = body as SendEmailPayload & { channel: "email" };
      return await sendEmail(payload);
    }

    if (channel === "sms") {
      const payload = body as SendSmsPayload & { channel: "sms" };
      return await sendSms(payload);
    }

    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function sendEmail(payload: SendEmailPayload & { channel: "email" }) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@constructedmatter.com";

  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: payload.to, subject: payload.subject, html: payload.body }),
  });

  const resendJson = await resendRes.json() as { id?: string; message?: string };
  const status = resendRes.ok ? "sent" : "failed";

  const logged = await logMessage({
    direction: "outbound",
    channel: "email",
    contact_id: payload.contact_id ?? null,
    to_address: payload.to,
    from_address: fromEmail,
    subject: payload.subject,
    body: payload.body,
    status,
    project_id: payload.project_id ?? null,
    quote_id: payload.quote_id ?? null,
    provider: "resend",
    provider_id: resendJson.id ?? null,
    error_message: resendRes.ok ? null : (resendJson.message ?? `HTTP ${resendRes.status}`),
    duration_seconds: null,
    recording_url: null,
    sent_at: new Date().toISOString(),
  });

  if (!resendRes.ok) {
    return NextResponse.json({ error: logged.error_message }, { status: 502 });
  }
  return NextResponse.json(logged);
}

async function sendSms(payload: SendSmsPayload & { channel: "sms" }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: "Twilio credentials not configured" }, { status: 503 });
  }

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: payload.to, From: fromNumber, Body: payload.body }).toString(),
    }
  );

  const twilioJson = await twilioRes.json() as { sid?: string; message?: string; status?: string };
  const status = twilioRes.ok ? "sent" : "failed";

  const logged = await logMessage({
    direction: "outbound",
    channel: "sms",
    contact_id: payload.contact_id ?? null,
    to_address: payload.to,
    from_address: fromNumber,
    subject: null,
    body: payload.body,
    status,
    project_id: payload.project_id ?? null,
    quote_id: null,
    provider: "twilio",
    provider_id: twilioJson.sid ?? null,
    error_message: twilioRes.ok ? null : (twilioJson.message ?? `HTTP ${twilioRes.status}`),
    duration_seconds: null,
    recording_url: null,
    sent_at: new Date().toISOString(),
  });

  if (!twilioRes.ok) {
    return NextResponse.json({ error: logged.error_message }, { status: 502 });
  }
  return NextResponse.json(logged);
}
