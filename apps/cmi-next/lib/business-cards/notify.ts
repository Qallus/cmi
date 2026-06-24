// Executes a card's lead-submit automations: owner email/SMS notifications and
// auto-reply email to the lead. Uses Resend (email) and Twilio (SMS).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Automation } from "./types";

type LeadInput = {
  name?: string; email?: string; phone?: string; company?: string; message?: string;
};

type CardInfo = {
  id: string;
  slug: string;
  display_name: string | null;
  card_name: string;
  staff_user_id: string | null;
  automations: Automation[] | null;
};

async function sendEmail(to: string, subject: string, text: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "noreply@constructedmatter.com";
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => {});
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  }).catch(() => {});
}

function leadSummary(lead: LeadInput): string {
  return [
    lead.name && `Name: ${lead.name}`,
    lead.email && `Email: ${lead.email}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.company && `Company: ${lead.company}`,
    lead.message && `Message: ${lead.message}`,
  ].filter(Boolean).join("\n");
}

export async function runLeadAutomations(card: CardInfo, lead: LeadInput): Promise<void> {
  const rules = (card.automations ?? []).filter((a) => a.enabled && a.trigger === "lead_submit");
  if (!rules.length) return;

  const cardLabel = card.display_name || card.card_name || "your card";

  // Owner contact lookup (for owner notifications).
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;
  if (card.staff_user_id) {
    const { data } = await getSupabaseAdmin()
      .from("staff_users").select("email, phone").eq("id", card.staff_user_id).maybeSingle();
    ownerEmail = data?.email ?? null;
    ownerPhone = data?.phone ?? null;
  }

  for (const rule of rules) {
    try {
      if (rule.action === "notify_owner_email" && ownerEmail) {
        await sendEmail(
          ownerEmail,
          `New lead from ${cardLabel}`,
          `You received a new lead from your digital business card (${cardLabel}):\n\n${leadSummary(lead)}`,
          lead.email || undefined,
        );
      } else if (rule.action === "notify_owner_sms" && ownerPhone) {
        await sendSms(ownerPhone, `New lead on ${cardLabel}: ${lead.name || lead.email || lead.phone || "someone"} — ${lead.message?.slice(0, 100) || "no message"}`);
      } else if (rule.action === "autoreply_email" && lead.email) {
        const body = rule.message?.trim() || `Thanks for reaching out! I received your details and will follow up shortly.\n\n— ${cardLabel}`;
        await sendEmail(lead.email, `Thanks for connecting with ${cardLabel}`, body, ownerEmail || undefined);
      }
    } catch {
      // Never fail lead capture because an automation failed.
    }
  }
}
