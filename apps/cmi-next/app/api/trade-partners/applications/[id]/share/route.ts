// Send an applicant the link back to their own application.
//
// This goes to the trade partner, not to staff — unlike a Pipeline share,
// which circulates a deal internally. The thing worth sending here is the
// resume link, so whoever actually holds the insurance certificates can pick
// the form up where it was left.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { applicationContact } from "@/lib/prequal/review";
import { sendEmail, sendSms, shareEmailHtml, escapeHtml } from "@/lib/messaging/send";
import { isSuppressed } from "@/lib/messaging/consent";
import { publicAppUrl } from "@/lib/twilio";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    await requirePrequal(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const channel = body?.channel === "sms" ? "sms" : "email";
    const note = typeof body?.note === "string" ? body.note.slice(0, 1000) : "";

    const app = await applicationContact(id);
    const link = resumeLink(app.token);

    const to = channel === "sms" ? app.contact_phone : app.contact_email;
    if (!to) {
      return NextResponse.json(
        { error: `No ${channel === "sms" ? "phone number" : "email address"} on this application.` },
        { status: 400 },
      );
    }
    if (await isSuppressed(channel, to)) {
      return NextResponse.json({ error: `${to} has opted out of ${channel === "sms" ? "texts" : "email"}.` }, { status: 400 });
    }

    const sent = channel === "sms"
      ? await sendSms(to, smsBody(app.contact_name, app.progress, link, note))
      : await sendEmail(to, `Your Constructed Matter trade partner application`, emailHtml(app, link, note));

    if (!sent) {
      return NextResponse.json(
        { error: `${channel === "sms" ? "Twilio" : "Resend"} isn't configured, so nothing was sent.` },
        { status: 502 },
      );
    }
    return NextResponse.json({ sent: true, channel, to });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

/** The public form, addressed so it reopens this applicant's own draft. */
export function resumeLink(token: string): string {
  return `${publicAppUrl()}/prequalification?t=${encodeURIComponent(token)}`;
}

function smsBody(name: string | null, progress: number, link: string, note: string): string {
  const hello = name ? `Hi ${name.split(" ")[0]}, ` : "";
  const where = progress > 0 && progress < 100 ? ` You're ${progress}% through.` : "";
  return `${hello}here's your Constructed Matter trade partner application.${where} ${link}${note ? `\n\n${note}` : ""}\n\nReply STOP to opt out.`;
}

function emailHtml(app: { label: string; contact_name: string | null; progress: number }, link: string, note: string) {
  const lines = [
    app.contact_name ? `For ${escapeHtml(app.contact_name)} at ${escapeHtml(app.label)}` : escapeHtml(app.label),
    app.progress > 0 && app.progress < 100
      ? `${app.progress}% complete — your answers are saved.`
      : "Your answers save as you go, so you can stop and come back.",
    "Only your name, email and phone are required to send it. Anything else can follow.",
  ];
  return shareEmailHtml({
    intro: "Your trade partner application",
    lines,
    note: note || null,
    url: link,
    cta: "Open your application",
    footer: "Constructed Matter, Inc. · 7314 E Osborn Dr Suite A, Scottsdale, AZ 85251",
  });
}
