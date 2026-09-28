// Email or text the partner an interview is with.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { getInterview, logEvent, InterviewError } from "@/lib/interviews/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail, sendSms, escapeHtml } from "@/lib/messaging/send";
import { isSuppressed } from "@/lib/messaging/consent";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireInterviews(request);
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const channel = payload?.channel === "sms" ? "sms" : "email";
    const body = String(payload?.body ?? "").trim();
    if (!body) throw new InterviewError("There is no message to send.");

    const interview = await getInterview(id);
    if (!interview) throw new InterviewError("Interview not found.", 404);

    const to = await recipient(interview.contact_id, interview.company_id, channel);
    if (!to) {
      throw new InterviewError(
        `No ${channel === "sms" ? "phone number" : "email address"} on file for this partner.`,
      );
    }
    if (await isSuppressed(channel, to)) {
      throw new InterviewError(`${to} has opted out of ${channel === "sms" ? "texts" : "email"}.`);
    }

    const sent = channel === "sms"
      ? await sendSms(to, `${body}\n\nReply STOP to opt out.`)
      : await sendEmail(to, String(payload?.subject ?? "Constructed Matter"), plainToHtml(body));

    if (!sent) {
      throw new InterviewError(
        `${channel === "sms" ? "Twilio" : "Resend"} is not configured, so nothing was sent.`, 502,
      );
    }

    await logEvent(id, channel === "sms" ? "sms_sent" : "email_sent", to, ctx.actor.id);
    return NextResponse.json({ sent: true, channel, to });
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

/** The contact on the interview, falling back to the company's own details. */
async function recipient(
  contactId: string | null, companyId: string | null, channel: "email" | "sms",
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const column = channel === "sms" ? "phone" : "email";

  if (contactId) {
    const { data } = await supabase.from("contacts").select(column).eq("id", contactId).maybeSingle();
    const value = (data as Record<string, string | null> | null)?.[column];
    if (value) return value;
  }
  if (companyId) {
    const { data } = await supabase.from("companies").select(column).eq("id", companyId).maybeSingle();
    const value = (data as Record<string, string | null> | null)?.[column];
    if (value) return value;
  }
  return null;
}

function plainToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map(
    (p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
  ).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:560px;">${paragraphs}
<p style="margin:20px 0 0;font-size:13px;color:#777;">Constructed Matter, Inc. &middot; 7314 E Osborn Dr Suite A, Scottsdale, AZ 85251</p></div>`;
}
