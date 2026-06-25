// Inbound SMS webhook — configure as the "A message comes in" URL on your number.
import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizePhone, publicAppUrl, shouldValidateWebhook } from "@/lib/twilio";
import { applyConsent } from "@/lib/messaging/consent";

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE"];
const START_WORDS = ["START", "YES", "UNSTOP"];

function xml(status = 200): Response {
  return new Response("<Response></Response>", {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(
    Array.from(form.entries()).map(([k, v]) => [k, String(v)]),
  ) as Record<string, string>;

  if (shouldValidateWebhook()) {
    const signature = request.headers.get("x-twilio-signature") || "";
    const url = `${publicAppUrl()}/api/webhooks/twilio/sms`;
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN || "",
      signature,
      url,
      params,
    );
    if (!valid) return xml(403);
  }

  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);
  const body = String(params.Body || "").trim() || "(empty message)";
  const providerId = String(params.MessageSid || "").trim() || null;

  // Honor STOP/START keywords (A2P 10DLC compliance).
  const keyword = body.trim().toUpperCase();
  if (from && STOP_WORDS.includes(keyword)) {
    await applyConsent({ channel: "sms", action: "opt_out", address: from, source: "sms_keyword" }).catch(() => {});
  } else if (from && START_WORDS.includes(keyword)) {
    await applyConsent({ channel: "sms", action: "opt_in", address: from, source: "sms_keyword" }).catch(() => {});
  }

  try {
    const sb = getSupabaseAdmin();

    // Match the sender to a known contact, if any.
    let contactId: string | null = null;
    if (from) {
      const { data } = await sb
        .from("contacts")
        .select("id")
        .eq("phone", from)
        .maybeSingle();
      contactId = data?.id ?? null;
    }

    await sb.from("messages").insert({
      direction: "inbound",
      channel: "sms",
      contact_id: contactId,
      to_address: to || null,
      from_address: from || null,
      body,
      status: "received",
      provider: "twilio",
      provider_id: providerId,
      sent_at: new Date().toISOString(),
    });
  } catch {
    // Never fail the webhook — Twilio retries on non-2xx.
  }

  return xml();
}
