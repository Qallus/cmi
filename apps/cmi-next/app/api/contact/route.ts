import { NextRequest, NextResponse } from "next/server";
import { createContact } from "@/lib/contacts/data";
import { createContactSubmission } from "@/lib/contact-submissions/data";
import { sendContactNotification } from "@/lib/email/contact-notify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, source, subject, message } = body;

    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ error: "Required fields are missing." }, { status: 400 });
    }

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
        type: null,
        company: null,
        address: null,
        city: null,
        state: null,
        zip: null,
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
      status: "new",
      contact_id: contactId,
    });

    // Also email a styled notification (info@ + BCC). Non-blocking — a mail
    // failure must never fail the submission, which is already saved.
    const site = req.headers.get("origin") || req.headers.get("referer") || null;
    try {
      await sendContactNotification({ firstName, lastName, email, phone, source, subject, message, site });
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
