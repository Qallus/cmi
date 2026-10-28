// Email to trade partner applicants (confirmation, MSA code, signed MSA copy).
// Sends from info@ via Resend, optionally with attachments. Held outside
// production like every other outbound path (see lib/notifications/dispatch.ts
// canSendOutbound): local dev runs against the live database, and an applicant
// must never get a test email. NOTIFY_FORCE_SEND=true overrides.
import { fromAddress } from "@/lib/email/from";

export type MailAttachment = { filename: string; content: Uint8Array };

export function canEmailApplicants(): boolean {
  if (process.env.NOTIFY_FORCE_SEND === "true") return true;
  return process.env.NODE_ENV === "production";
}

export async function sendApplicantEmail(input: {
  to: string | string[];
  cc?: string | string[] | null;
  subject: string;
  html: string;
  replyTo?: string | null;
  attachments?: MailAttachment[];
}): Promise<{ sent: boolean; held?: boolean; error?: string }> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (!canEmailApplicants()) {
    console.info(`[prequal] email held outside production → ${to.join(", ")}: ${input.subject}`);
    return { sent: false, held: true };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY is not configured." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromAddress(),
      to,
      ...(input.cc ? { cc: Array.isArray(input.cc) ? input.cc : [input.cc] } : {}),
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.attachments?.length
        ? { attachments: input.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
        : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { sent: false, error: body.message ?? `Resend HTTP ${res.status}` };
  }
  return { sent: true };
}
