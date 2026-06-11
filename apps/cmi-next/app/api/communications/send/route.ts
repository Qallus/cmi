import { NextResponse } from "next/server";
import { logMessage } from "@/lib/communications/data";
import type { Message } from "@/lib/communications/types";
import type { SendCallPayload, SendEmailPayload, SendSmsPayload } from "@/lib/communications/types";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { channel: "email" | "sms" | "call" } & (SendEmailPayload | SendSmsPayload | SendCallPayload);
    const { channel } = body;

    if (channel === "email") {
      const payload = body as SendEmailPayload & { channel: "email" };
      return await sendEmail(payload);
    }

    if (channel === "sms") {
      const payload = body as SendSmsPayload & { channel: "sms" };
      return await sendSms(payload);
    }

    if (channel === "call") {
      const payload = body as SendCallPayload & { channel: "call" };
      return await startCall(payload);
    }

    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function sendEmail(payload: SendEmailPayload & { channel: "email" }) {
  const resendKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@constructedmatter.com";

  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured. Restart the Next.js dev server after adding .env.local values." }, { status: 503 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: payload.to, subject: payload.subject, html: payload.body }),
  });

  const resendJson = await resendRes.json() as { id?: string; message?: string };
  const status = resendRes.ok ? "sent" : "failed";

  const logged = await safeLogMessage({
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

async function startCall(payload: SendCallPayload & { channel: "call" }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const bridgeNumber = process.env.TWILIO_OUTBOUND_BRIDGE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: "Twilio credentials not configured. Restart the Next.js dev server after adding .env.local values." }, { status: 503 });
  }

  if (!payload.to) {
    return NextResponse.json({ error: "Recipient phone number is required." }, { status: 400 });
  }

  const twiml = [
    "<Response>",
    "<Say voice=\"alice\">This is Constructed Matter. Connecting your call.</Say>",
    bridgeNumber ? `<Dial callerId="${escapeXml(fromNumber)}">${escapeXml(bridgeNumber)}</Dial>` : "<Pause length=\"1\" />",
    "</Response>",
  ].join("");

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: payload.to,
        From: fromNumber,
        Twiml: twiml,
      }).toString(),
    }
  );

  const twilioJson = await twilioRes.json() as { sid?: string; message?: string; status?: string };
  const status = twilioRes.ok ? "queued" : "failed";

  const logged = await safeLogMessage({
    direction: "outbound",
    channel: "call",
    contact_id: payload.contact_id ?? null,
    to_address: payload.to,
    from_address: fromNumber,
    subject: "Outbound call",
    body: bridgeNumber ? `Outbound call connected through ${bridgeNumber}` : "Outbound call queued from dashboard.",
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

async function safeLogMessage(msg: Omit<Message, "id" | "created_at">): Promise<Message> {
  try {
    return await logMessage(msg);
  } catch (err) {
    return {
      id: msg.provider_id || `unsaved-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...msg,
      error_message: msg.error_message ?? `Message history was not saved: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
