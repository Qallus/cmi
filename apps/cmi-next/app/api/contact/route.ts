import { NextRequest, NextResponse } from "next/server";
import { createContact } from "@/lib/contacts/data";
import { createContactSubmission } from "@/lib/contact-submissions/data";
import { sendContactNotification } from "@/lib/email/contact-notify";
import type { ContactSubmissionKind } from "@/lib/contact-submissions/types";
import { botReason, clientIp, verifyTurnstile } from "@/lib/spam/turnstile";

// The "Let's Start a Conversation" form. Three paths (Brandon's trade partner
// brief §4): a client lead, a product/service pitch, or a trade partner —
// trade partners are sent to the prequalification application by the page,
// so only the first two arrive here. Vendor pitches are filed as vendors,
// never as leads. Spam is logged (kind 'spam') rather than silently dropped.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, source, subject, message,
      addressLine1, addressLine2, city, state, zip,
      projectBudget, budgetAmount, projectStatus, company,
    } = body;
    const path: ContactSubmissionKind = body.path === "vendor_pitch" ? "vendor_pitch" : "client";

    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ error: "Required fields are missing." }, { status: 400 });
    }

    const statusList: string[] = Array.isArray(projectStatus)
      ? projectStatus.filter((s: unknown): s is string => typeof s === "string" && !!s)
      : [];
    const submission = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      how_heard: source || null,
      subject: path === "vendor_pitch" && company ? `${subject} (${company})` : subject,
      message,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      project_budget: projectBudget || null,
      budget_amount: projectBudget === "Other" ? (budgetAmount || null) : null,
      project_status: statusList,
      status: "new" as const,
      contact_id: null as string | null,
    };

    // Bots: log quietly and answer as if it worked, so they don't retry.
    const reason = botReason(body);
    if (reason) {
      await createContactSubmission({ ...submission, kind: "spam", spam_reason: reason, status: "archived" }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    // A failed challenge may be a real person: ask them to retry.
    if (!(await verifyTurnstile(body.turnstileToken, clientIp(req.headers)))) {
      return NextResponse.json({ error: "We couldn't verify you're not a robot. Please try again." }, { status: 400 });
    }

    // A single address string for the contacts record (which stores one line).
    const addressStr = [addressLine1, addressLine2].filter(Boolean).join(", ") || null;

    // Save raw submission first (always succeeds even if contact upsert fails)
    let contactId: string | null = null;
    try {
      const contact = await createContact({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        source: source || null,
        notes: `Subject: ${subject}\n\n${message}`,
        status: "active",
        tags: path === "vendor_pitch" ? ["website-contact", "vendor-pitch"] : ["website-contact"],
        type: path === "vendor_pitch" ? "Vendor" : "Lead",
        company: path === "vendor_pitch" ? (company || null) : null,
        address: addressStr,
        city: city || null,
        state: state || null,
        zip: zip || null,
      });
      contactId = contact.id;
    } catch {
      // Don't fail the submission if the contact record fails
    }

    await createContactSubmission({ ...submission, kind: path, contact_id: contactId });

    // Also email a styled notification (info@ + BCC). Non-blocking — a mail
    // failure must never fail the submission, which is already saved.
    const site = req.headers.get("origin") || req.headers.get("referer") || null;
    try {
      await sendContactNotification({
        firstName, lastName, email, phone, source,
        subject: path === "vendor_pitch" ? `[Vendor pitch] ${submission.subject}` : subject,
        message, site,
        addressLine1, addressLine2, city, state, zip,
        projectBudget: projectBudget === "Other" ? (budgetAmount || "Other") : projectBudget,
        projectStatus: statusList,
      });
    } catch (mailErr) {
      console.error("[api/contact] notification email failed:", mailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message." },
      { status: 500 }
    );
  }
}
