// The From header, in one place.
//
// Every mailbox shows the display name, and falls back to the local part of
// the address when there isn't one — which is why mail from
// info@constructedmatter.com used to arrive from "info". Sixteen call sites
// each built their own From, and only one of them set a name, so this exists
// to make that impossible to get wrong again.

/** The name on everything CMI sends. */
export const FROM_NAME = "Constructed Matter, Inc.";

/**
 * A display name is only a bare atom sequence if it has no specials. Ours has
 * a comma, and an unquoted comma in a From header is an address separator —
 * the message would be read as two broken addresses. RFC 5322 §3.2.3.
 */
function quoteName(name: string): string {
  if (!/[",:;<>@\\[\]()]/.test(name)) return name;
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * `"Constructed Matter, Inc." <info@constructedmatter.com>`
 *
 * `fallback` is the address to use when RESEND_FROM_EMAIL is unset — different
 * callers have historically defaulted to info@ or noreply@, and that choice is
 * a deliverability one, so it stays with the caller.
 *
 * An env value that already carries its own display name is passed through
 * untouched, so the From can still be overridden per environment.
 */
export function fromAddress(fallback = "info@constructedmatter.com"): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  const value = configured || fallback;
  if (value.includes("<")) return value;
  return `${quoteName(FROM_NAME)} <${value}>`;
}
