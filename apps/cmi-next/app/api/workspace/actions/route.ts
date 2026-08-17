import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";
import { isSuppressed } from "@/lib/messaging/consent";
import { normalizePhone } from "@/lib/twilio";

export const runtime = "nodejs";

type Body = {
  kind: "dm" | "sms" | "email" | "schedule";
  targetId?: string | null;
  toPhone?: string | null;
  subject?: string | null;
  message?: string;
  date?: string | null;
  time?: string | null;
};

// Dispatch a Workspace action (in-app DM, Twilio SMS, staff email, or a
// schedule/calendar entry). The editor requires an explicit confirm before
// calling this. Team-gated via requireWorkspaceAccess.
export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceAccess(request);
    const body = (await request.json().catch(() => ({}))) as Body;
    const kind = body.kind;
    const message = (body.message ?? "").trim();
    const sb = getSupabaseAdmin();

    // Resolve the target staff member (for dm/email/schedule and default SMS).
    let target: { id: string; email: string | null; phone: string | null; name: string } | null = null;
    if (body.targetId) {
      const { data } = await sb.from("staff_users").select("id, email, phone, display_name, first_name, last_name").eq("id", body.targetId).maybeSingle();
      if (data) target = { id: data.id, email: data.email ?? null, phone: data.phone ?? null, name: data.display_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || data.email || "Staff" };
    }

    if (kind === "dm") {
      if (!target) return NextResponse.json({ error: "Select a staff member." }, { status: 400 });
      if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      const conversationId = await findOrCreateConversation({ id: actor.id, kind: "staff" }, { id: target.id, kind: "staff" }, null);
      await sendMessage(actor.id, conversationId, { body: message });
      return NextResponse.json({ ok: true, conversationId });
    }

    if (kind === "email") {
      const to = target?.email || null;
      if (!to) return NextResponse.json({ error: "That staff member has no email on file." }, { status: 400 });
      if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      if (await isSuppressed("email", to)) return NextResponse.json({ error: `${to} has opted out of email.` }, { status: 409 });
      const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
      if (!apiKey) return NextResponse.json({ error: "Email isn't configured (RESEND_API_KEY)." }, { status: 503 });
      const from = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
      const subject = (body.subject ?? "").trim() || "A message from Constructed Matter";
      const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#191815;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div><p style="margin-top:16px;font-size:12px;color:#9a938a;">Sent from the CMI Workspace by ${escapeHtml(actor.display_name || actor.email)}.</p>`;
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html }) });
      if (!res.ok) return NextResponse.json({ error: `Email failed (${res.status}).` }, { status: 502 });
      return NextResponse.json({ ok: true });
    }

    if (kind === "sms") {
      const raw = target?.phone || body.toPhone || "";
      const to = normalizePhone(raw);
      if (!to) return NextResponse.json({ error: "A phone number is required." }, { status: 400 });
      if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      if (await isSuppressed("sms", to)) return NextResponse.json({ error: `${to} has opted out of SMS.` }, { status: 409 });
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER;
      if (!sid || !token || !from) return NextResponse.json({ error: "SMS isn't configured (Twilio)." }, { status: 503 });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); return NextResponse.json({ error: (j as any).message || `SMS failed (${res.status}).` }, { status: 502 }); }
      return NextResponse.json({ ok: true });
    }

    if (kind === "schedule") {
      if (!target) return NextResponse.json({ error: "Select a staff member." }, { status: 400 });
      if (!body.date) return NextResponse.json({ error: "A date is required." }, { status: 400 });
      const start = new Date(`${body.date}T${(body.time || "09:00")}:00`);
      if (isNaN(start.getTime())) return NextResponse.json({ error: "Invalid date/time." }, { status: 400 });
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const title = (message || body.subject || "Scheduled item").slice(0, 140);
      const { error } = await sb.from("bookings").insert({
        title, booking_type: "internal", status: "scheduled",
        start_datetime: start.toISOString(), end_datetime: end.toISOString(),
        host_name: target.name, host_email: target.email,
        notes: `Added from the CMI Workspace by ${actor.display_name || actor.email}.`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
