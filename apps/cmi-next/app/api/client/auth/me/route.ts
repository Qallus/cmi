import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";

export async function GET(request: Request) {
  try {
    const { contact } = await requireClient(request);
    const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.company || contact.email;
    const initials = `${(contact.first_name ?? " ")[0] ?? ""}${(contact.last_name ?? " ")[0] ?? ""}`.trim().toUpperCase() || "?";
    return NextResponse.json({ client: { id: contact.id, name, email: contact.email, initials } });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ client: null }, { status: e.status ?? 401 });
  }
}
