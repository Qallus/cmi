import { loadContacts } from "@/lib/contacts/data";
import { getSessionStaff } from "@/lib/auth/server-session";
import { ContactsClient } from "./contacts-client";

export const metadata = { title: "Contacts — CMI Dashboard" };

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const staff = await getSessionStaff();
  const role = staff?.role_slug ?? null;
  try {
    const contacts = await loadContacts();
    return <ContactsClient initialContacts={contacts} role={role} />;
  } catch {
    return <ContactsClient initialContacts={[]} role={role} />;
  }
}
