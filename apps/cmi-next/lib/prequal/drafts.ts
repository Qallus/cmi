// Pre-written emails for the review queue (trade partner brief §6). They open
// as editable drafts in the application drawer — never sent automatically.
// Pure (no I/O, no aliases) so lib/prequal/drafts.test.mjs runs them directly.

export type DraftInput = {
  firstName: string | null;
  company: string | null;
  reviewerName: string;
  reviewerTitle?: string | null;
};

export type Draft = { subject: string; body: string };

const OFFICE = "7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251";

function greeting(first: string | null): string {
  return `Hi ${first?.trim() || "there"},`;
}

function signature(d: DraftInput): string {
  return ["Best,", d.reviewerName, d.reviewerTitle, "Constructed Matter, Inc.", "(480) 628-4458"].filter(Boolean).join("\n");
}

/** "Schedule Follow-Up Meeting": a warm reply with a spot to plug in a time. */
export function followUpMeetingDraft(d: DraftInput): Draft {
  return {
    subject: `Next step with Constructed Matter${d.company ? ` · ${d.company}` : ""}`,
    body: [
      greeting(d.firstName),
      "",
      `Thank you for submitting your trade partner application${d.company ? ` for ${d.company}` : ""}. We'd love to meet and learn more about your team and the work you do.`,
      "",
      `Would [DAY, DATE at TIME] work for a short meeting at our office (${OFFICE})? If that doesn't suit, send a couple of times that do and we'll make it work.`,
      "",
      signature(d),
    ].join("\n"),
  };
}

/** "Follow Up (missing documents)": lists exactly what's outstanding, with the upload link. */
export function missingDocumentsDraft(d: DraftInput & { missing: string[]; uploadUrl: string; notes?: string | null }): Draft {
  const list = d.missing.length ? d.missing.map((m) => `• ${m}`).join("\n") : "• (nothing outstanding)";
  return {
    subject: `Documents needed for your Constructed Matter application${d.company ? ` · ${d.company}` : ""}`,
    body: [
      greeting(d.firstName),
      "",
      "Thank you for your application. Before we can move forward we need the following:",
      "",
      list,
      "",
      `You can upload them here: ${d.uploadUrl}`,
      ...(d.notes?.trim() ? ["", d.notes.trim()] : []),
      "",
      "Or simply reply to this email with them attached.",
      "",
      signature(d),
    ].join("\n"),
  };
}

/** Approval / onboarding email paragraphs (sent on Approve, from info@). */
export function approvalParagraphs(d: { firstName: string | null; company: string | null; outstanding: string[]; hasGuide: boolean; uploadUrl: string }): string[] {
  const out = [
    `${greeting(d.firstName)} welcome aboard. ${d.company ?? "Your company"} is now an approved Constructed Matter trade partner.`,
    d.hasGuide
      ? "Our Trade Partner Onboarding Guide is attached. It covers how we work together, bidding, scheduling, invoicing and safety."
      : "We'll be in touch with our onboarding guide and next steps for upcoming bids.",
  ];
  if (d.outstanding.length) {
    out.push(`Before we can issue work, we still need: ${d.outstanding.join(", ")}. Upload them at ${d.uploadUrl} or reply to this email with them attached.`);
  }
  out.push("Keep your insurance and W-9 current through the same link. We'll remind you before anything expires.");
  return out;
}

/** Turn a plain-text draft into paragraphs for the branded email shell. */
export function draftParagraphs(body: string): string[] {
  return body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
