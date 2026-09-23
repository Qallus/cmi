// The exact SMS consent wording shown to the public, in one place.
//
// Carriers and The Campaign Registry review the literal text next to a consent
// checkbox, and our A2P 10DLC campaign submission quotes these strings. Every
// surface that collects SMS consent must show the same disclosure, so they are
// defined here rather than retyped per page.

/** Required under every SMS consent checkbox. */
export const SMS_FINEPRINT =
  "Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase.";

/** The general service/project consent on /sms-opt-in. */
export const SMS_SERVICE_LABEL =
  "Yes, I agree to receive recurring service, account, and project-related SMS or MMS messages from Constructed Matter, Inc. at the mobile number provided.";

export const SMS_SERVICE_BODY =
  "Messages may include inquiry follow-ups, estimate or proposal updates, appointment reminders, project schedules, milestones, design selections, approvals, permitting or inspection updates, site-access coordination, delivery notices, invoices, payment reminders, warranties, service updates, safety notices, and communications with authorized project participants. For employees, subcontractors, and other authorized project participants who opt in, service messages may also include work schedules, job assignments, task and daily-log reminders, and project coordination updates.";

/** The marketing consent on /sms-opt-in. */
export const SMS_MARKETING_LABEL =
  "Yes, I expressly agree to receive recurring marketing and promotional SMS or MMS messages from Constructed Matter, Inc. at the mobile number provided.";

export const SMS_MARKETING_BODY =
  "Messages may include information about CMI services, construction or design content, events, announcements, offers, promotions, and follow-up marketing.";

/**
 * Appointment booking and event registration. Narrower than the general
 * service consent — it covers this appointment and related scheduling only —
 * but it carries the same required disclosures.
 */
export const SMS_BOOKING_LABEL =
  "Yes, I agree to receive SMS or MMS text messages from Constructed Matter, Inc. at the mobile number provided about this appointment.";

export const SMS_BOOKING_BODY =
  "Messages may include booking confirmations, reminders, schedule changes, and site-access or arrival coordination for this appointment.";

/**
 * What gets stored as proof of consent: the literal words the person saw when
 * they ticked the box.
 */
export function bookingDisclosureText(): string {
  return [SMS_BOOKING_LABEL, SMS_BOOKING_BODY, SMS_FINEPRINT].join(" ");
}
