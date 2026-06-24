// Recording status webhook — Twilio POSTs here when a call recording completes.
// The recordingStatusCallback URL is set in the voice TwiML, so no console config
// is required beyond the URL being publicly reachable.
import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl, shouldValidateWebhook } from "@/lib/twilio";

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
    const url = `${publicAppUrl()}/api/webhooks/twilio/recording-status`;
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN || "",
      signature,
      url,
      params,
    );
    if (!valid) return xml(403);
  }

  const recordingSid = params.RecordingSid || null;
  const callSid = params.CallSid || null;
  const recordingUrl = params.RecordingUrl ? `${params.RecordingUrl}.mp3` : null;
  const recordingStatus = params.RecordingStatus || null;
  const duration = params.RecordingDuration ? Number(params.RecordingDuration) : null;

  try {
    const sb = getSupabaseAdmin();
    await sb
      .from("call_recordings")
      .upsert(
        {
          call_sid: callSid,
          recording_sid: recordingSid,
          recording_url: recordingUrl,
          recording_status: recordingStatus,
          recording_duration_seconds: duration,
        },
        { onConflict: "recording_sid" },
      );
  } catch {
    // Swallow — avoid Twilio retry storms.
  }

  return xml();
}
