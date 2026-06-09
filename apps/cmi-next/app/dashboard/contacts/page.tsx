import { loadContacts } from "@/lib/contacts/data";
import { ContactsClient } from "./contacts-client";

export const metadata = { title: "Contacts — CMI Dashboard" };

export default async function ContactsPage() {
  try {
    const contacts = await loadContacts();
    return <ContactsClient initialContacts={contacts} />;
  } catch {
    return <ContactsClient initialContacts={[]} />;
  }
}
