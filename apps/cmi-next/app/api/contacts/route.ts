import { NextRequest, NextResponse } from "next/server";
import { loadContacts, createContact, DuplicateContactError } from "@/lib/contacts/data";
import { denyUnlessStaff } from "@/lib/auth/guard";

export async function GET() {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const contacts = await loadContacts();
    return NextResponse.json(contacts);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load contacts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const body = await req.json();
    // `confirm_duplicate` is set once someone has seen the suggested match and
    // decided it's a different person; it never overrides a taken email.
    const { confirm_duplicate: confirmed, ...draft } = body ?? {};
    const contact = await createContact(draft, { confirmed: confirmed === true });
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateContactError) {
      return NextResponse.json({ error: err.message, duplicate: err.existing }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create contact." }, { status: 500 });
  }
}
