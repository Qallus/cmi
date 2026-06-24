// Shared Twilio configuration helpers for the Communications dialer.

export function getOwnedNumbers(): string[] {
  const list = process.env.TWILIO_PHONE_NUMBERS || "";
  if (list) return list.split(",").map((n) => n.trim()).filter(Boolean);
  const single = process.env.TWILIO_PHONE_NUMBER || "";
  return single ? [single] : [];
}

export function getSmsNumbers(): string[] {
  const list = process.env.TWILIO_SMS_NUMBERS || "";
  if (list) return list.split(",").map((n) => n.trim()).filter(Boolean);
  const owned = getOwnedNumbers();
  return owned.length ? [owned[0]] : [];
}

export function defaultCallerId(): string {
  return process.env.TWILIO_PHONE_NUMBER || getOwnedNumbers()[0] || "";
}

// Identity used for the Voice SDK browser client (Access Token + <Client> dial).
export const VOICE_CLIENT_IDENTITY = "cmi-admin";

export function publicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");
}

export function recordingStatusCallbackUrl(): string {
  return `${publicAppUrl()}/api/webhooks/twilio/recording-status`;
}

export function shouldValidateWebhook(): boolean {
  return ["true", "1"].includes(String(process.env.TWILIO_VALIDATE_WEBHOOK || "").toLowerCase());
}

export function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/[^\d+]/g, "");
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
