// Presentation helpers shared by the submissions list and the detail page.
// Pure functions only, so both a server component and a client one can use
// them without dragging React in.
import type { ContactSubmission, ContactSubmissionStatus } from "./types";

export function formatSubmissionAddress(s: ContactSubmission): string {
  const l1 = [s.address_line1, s.address_line2].filter(Boolean).join(", ");
  const cityState = [s.city, s.state].filter(Boolean).join(", ");
  const l2 = [cityState, s.zip].filter(Boolean).join(" ");
  return [l1, l2].filter(Boolean).join(" · ");
}

/** The name to show, falling back to the email local part, then "Someone". */
export function submissionName(s: ContactSubmission): string {
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  const local = (s.email ?? "").split("@")[0];
  return local || "Someone";
}

/** Two letters for the avatar. */
export function submissionInitials(s: ContactSubmission): string {
  const first = (s.first_name ?? "").trim();
  const last = (s.last_name ?? "").trim();
  if (first || last) return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
  return ((s.email ?? "?")[0] ?? "?").toUpperCase();
}

/** "Other" budgets carry their amount in a separate free-text field. */
export function submissionBudget(s: ContactSubmission): string | null {
  return s.budget_amount || s.project_budget || null;
}

export const SUBMISSION_STATUSES: ContactSubmissionStatus[] = ["new", "read", "archived"];

export function statusLabel(status: ContactSubmissionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Only "new" is loud. A read submission is ordinary and an archived one is
 * deliberately quiet, so the eye goes to the ones nobody has answered.
 */
export function statusTone(status: ContactSubmissionStatus): string {
  switch (status) {
    case "new": return "border-accent/40 bg-accent/10 text-accent";
    case "read": return "border-border bg-muted text-muted-foreground";
    default: return "border-border bg-transparent text-muted-foreground/70";
  }
}

/** Digits only, in the form tel:/Twilio want. Assumes US when 10 digits. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

/** (480) 352-7598, matching how phone numbers are shown everywhere else. */
export function displayPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return phone ?? "";
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/**
 * Compose links for the two clients the team actually uses.
 *
 * These hand off to a real mail client rather than sending through Resend, for
 * the times someone wants the reply in their own sent folder with their own
 * signature. The in-app reply is still the default.
 */
export function composeLinks(to: string, subject: string, body = ""): { gmail: string; outlook: string; mailto: string } {
  const e = encodeURIComponent;
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}&su=${e(subject)}&body=${e(body)}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${e(to)}&subject=${e(subject)}&body=${e(body)}`,
    mailto: `mailto:${e(to)}?subject=${e(subject)}${body ? `&body=${e(body)}` : ""}`,
  };
}
