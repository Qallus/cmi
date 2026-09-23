// Records the SMS consent given on the public booking and event-registration
// forms, so those opt-ins carry the same proof as the /sms-opt-in page:
// timestamp, source URL, IP, and the literal words the person agreed to.
//
// Without this the checkbox would be a preference with nothing behind it, and
// a carrier audit of an A2P campaign would find no evidence of consent.
import { applyConsent } from "./consent";
import { CONSENT_DISCLOSURE_VERSION } from "./consent";
import { bookingDisclosureText } from "./disclosure";

type Person = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
};

/**
 * Best effort: a consent-logging failure must never lose someone's booking,
 * so this resolves either way and reports what happened.
 */
export async function recordBookingSmsConsent(
  request: Request,
  input: { phone: string; person?: Person; sourceUrl?: string | null; recordType?: string; recordId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!input.phone?.trim()) return { ok: false, error: "No phone number." };

  const forwarded = request.headers.get("x-forwarded-for");
  try {
    const result = await applyConsent({
      channel: "sms",
      action: "opt_in",
      address: input.phone,
      categories: ["service"],
      source: "booking_form",
      recordType: input.recordType,
      recordId: input.recordId ?? null,
      person: { ...input.person, phone: input.phone },
      // Booking consent is narrow; it must not revoke marketing consent.
      preserveOtherCategories: true,
      audit: {
        sourceUrl: input.sourceUrl ?? request.headers.get("referer"),
        ip: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        disclosureText: bookingDisclosureText(),
        disclosureVersion: CONSENT_DISCLOSURE_VERSION,
      },
    });
    return "error" in result ? { ok: false, error: result.error } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Consent logging failed." };
  }
}
