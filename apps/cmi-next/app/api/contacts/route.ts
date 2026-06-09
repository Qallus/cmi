import { NextRequest, NextResponse } from "next/server";
import { loadContacts, createContact } from "@/lib/contacts/data";

export async function GET() {
  try {
    const contacts = await loadContacts();
    return NextResponse.json(contacts);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load contacts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contact = await createContact(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create contact." }, { status: 500 });
  }
}
