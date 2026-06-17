import { createHmac } from "crypto";

function twiml(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function verifyTwilioSignature(request: Request, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const twilioSignature = request.headers.get("x-twilio-signature") ?? "";
  const url = request.url;

  // Build the base string: URL + sorted POST params concatenated
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const baseString = url + sortedKeys.map((k) => k + (params.get(k) ?? "")).join("");

  const expected = createHmac("sha1", authToken).update(baseString).digest("base64");
  return expected === twilioSignature;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyTwilioSignature(request, rawBody)) {
    return new Response("Forbidden", { status: 403 });
  }

  const forwardNumber = process.env.TWILIO_INBOUND_FORWARD_NUMBER || process.env.TWILIO_OUTBOUND_BRIDGE_NUMBER;

  if (!forwardNumber) {
    return twiml([
      "<Response>",
      "<Say voice=\"alice\">Thank you for calling Constructed Matter. We are unable to connect your call at this moment. Please try again shortly.</Say>",
      "</Response>",
    ].join(""));
  }

  return twiml([
    "<Response>",
    "<Say voice=\"alice\">Thank you for calling Constructed Matter. Please hold while we connect your call.</Say>",
    `<Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || "")}">${escapeXml(forwardNumber)}</Dial>`,
    "</Response>",
  ].join(""));
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
