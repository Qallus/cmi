// Create a trade partner without leaving the New Interview dialog.
//
// A company nobody has met yet is exactly the case an interview exists for, so
// making the picker a dead end when the name is not already in the directory
// is the wrong behaviour. This creates the company, and a contact against it
// when a name or email is given, so the partner lands in Contacts too.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { findCompanyByName, findOrCreateCompany } from "@/lib/companies/data";
import { createContact, DuplicateContactError } from "@/lib/contacts/data";
import { InterviewError } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireInterviews(request);
    const body = await request.json().catch(() => ({}));

    const name = String(body?.name ?? "").trim();
    if (!name) throw new InterviewError("A company needs a name.");

    // Say so rather than silently handing back the existing row — picking the
    // one that is already there is a different decision from making a new one.
    const existing = await findCompanyByName(name);
    if (existing && !body?.use_existing) {
      return NextResponse.json(
        { error: `“${existing.name}” is already in the directory.`, existing_id: existing.id },
        { status: 409 },
      );
    }

    const company = await findOrCreateCompany(name, {
      partner_type: body?.partner_type || null,
      trades: Array.isArray(body?.trades) && body.trades.length ? body.trades : null,
      phone: body?.phone || null,
      email: body?.email || null,
      qualification_status: "prospect",
    });

    // The contact is optional: you may know the company before the person.
    let contactId: string | null = null;
    let contactWarning: string | null = null;
    const first = String(body?.contact_first_name ?? "").trim();
    const last = String(body?.contact_last_name ?? "").trim();
    const email = String(body?.contact_email ?? "").trim();

    if (first || last || email) {
      if (!email) {
        contactWarning = "No contact was created — contacts need an email address.";
      } else {
        try {
          const contact = await createContact({
            // first_name, last_name and metadata are NOT NULL on contacts, so
            // these are empty rather than null.
            first_name: first,
            last_name: last,
            email,
            phone: body?.contact_phone || null,
            company: company.name,
            type: "Vendor",
            status: "active",
            source: "interview",
            address: null, city: null, state: null, zip: null,
            notes: null, tags: null, lead_owner: null, metadata: {},
          } as Parameters<typeof createContact>[0]);
          contactId = contact.id;
        } catch (err) {
          // The company is already made. Losing it because the contact failed
          // would be the worse outcome, so this degrades to a warning.
          contactWarning = err instanceof DuplicateContactError
            ? `${email} is already a contact, so no new one was created.`
            : `The company was created, but the contact was not: ${(err as Error).message}`;
        }
      }
    }

    return NextResponse.json({ company, contact_id: contactId, warning: contactWarning });
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
