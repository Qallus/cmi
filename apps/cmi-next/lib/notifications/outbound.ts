/**
 * Whether this process is allowed to reach real people.
 *
 * Local development runs against the live database with live Resend, Twilio and
 * VAPID keys, so without this a developer testing a feature would email, text
 * or push actual clients and staff. Callers still write their in-app rows, so
 * the whole path stays testable locally; only the outbound leg is held back.
 * Set NOTIFY_FORCE_SEND=true to deliberately send a real one.
 *
 * Lives on its own (no imports) so the low-level senders can use it without a
 * cycle through lib/notifications/dispatch.ts.
 */
export function canSendOutbound(): boolean {
  if (process.env.NOTIFY_FORCE_SEND === "true") return true;
  return process.env.NODE_ENV === "production";
}

/** One line in the server log for a message that was held back. */
export function logHeld(channel: "email" | "sms", to: string, what: string): void {
  console.info(`[outbound held] ${channel} to ${to.replace(/(.{3}).*(@.*)?$/, "$1…$2")}: ${what.slice(0, 80)} (not production; set NOTIFY_FORCE_SEND=true to send)`);
}
