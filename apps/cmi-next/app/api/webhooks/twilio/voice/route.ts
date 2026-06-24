// TwiML handler for Twilio Voice — outbound browser calls and inbound routing.
// Configured as the Voice Request URL on your TwiML App (and phone number).
import {
  VOICE_CLIENT_IDENTITY,
  defaultCallerId,
  escapeXml,
  getOwnedNumbers,
  recordingStatusCallbackUrl,
} from "@/lib/twilio";

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "application/xml" },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const params = new URLSearchParams(raw);

  const to = params.get("To");
  const ownedNumbers = getOwnedNumbers();

  // The browser dialer passes a preferred caller ID via the TwiML App custom param.
  const requestedCallerId = params.get("callerId") || params.get("CallerID") || "";
  const callerId =
    requestedCallerId && ownedNumbers.includes(requestedCallerId)
      ? requestedCallerId
      : defaultCallerId();

  const recordingCallback = recordingStatusCallbackUrl();
  const isOwnedNumber = !!to && ownedNumbers.includes(to);
  const isClientUri = !!to && to.startsWith("client:");

  // Outbound: browser client dialing a real external number.
  if (to && !isOwnedNumber && !isClientUri) {
    return xml(
      `<Response>` +
        `<Dial callerId="${escapeXml(callerId)}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackEvent="completed">` +
        `<Number>${escapeXml(to)}</Number>` +
        `</Dial>` +
        `</Response>`,
    );
  }

  // Inbound: someone called one of our Twilio numbers — ring the browser client,
  // fall through to a recorded voicemail if nobody answers.
  if (to && isOwnedNumber) {
    return xml(
      `<Response>` +
        `<Say voice="alice">Thank you for calling Constructed Matter. Please hold while we connect you. This call may be recorded.</Say>` +
        `<Dial timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackEvent="completed">` +
        `<Client><Identity>${escapeXml(VOICE_CLIENT_IDENTITY)}</Identity></Client>` +
        `</Dial>` +
        `<Say voice="alice">We're unavailable right now. Please leave a message after the tone.</Say>` +
        `<Record maxLength="120" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackEvent="completed" />` +
        `</Response>`,
    );
  }

  return xml(`<Response><Say voice="alice">Thank you for calling Constructed Matter. Goodbye.</Say></Response>`);
}
