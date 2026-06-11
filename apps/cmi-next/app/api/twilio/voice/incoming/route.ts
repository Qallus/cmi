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

export async function POST() {
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
  return POST();
}
