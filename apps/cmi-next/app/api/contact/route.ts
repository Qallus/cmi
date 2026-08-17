import { NextRequest, NextResponse } from "next/server";
import { createContact } from "@/lib/contacts/data";
import { createContactSubmission } from "@/lib/contact-submissions/data";
import { sendContactNotification } from "@/lib/email/contact-notify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, source, subject, message,
      addressLine1, addressLine2, city, state, zip,
      projectBudget, budgetAmount, projectStatus,
    } = body;

    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ error: "Required fields are missing." }, { status: 400 });
    }

    const statusList: string[] = Array.isArray(projectStatus)
      ? projectStatus.filter((s: unknown): s is string => typeof s === "string" && !!s)
      : [];
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
        tags: ["website-contact"],
        type: "Lead",
        company: null,
        address: addressStr,
        city: city || null,
        state: state || null,
        zip: zip || null,
      });
      contactId = contact.id;
    } catch {
      // Don't fail the submission if the contact record fails
    }

    await createContactSubmission({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      how_heard: source || null,
      subject,
      message,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      project_budget: projectBudget || null,
      budget_amount: projectBudget === "Other" ? (budgetAmount || null) : null,
      project_status: statusList,
      status: "new",
      contact_id: contactId,
    });

    // Also email a styled notification (info@ + BCC). Non-blocking — a mail
    // failure must never fail the submission, which is already saved.
    const site = req.headers.get("origin") || req.headers.get("referer") || null;
    try {
      await sendContactNotification({
        firstName, lastName, email, phone, source, subject, message, site,
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
