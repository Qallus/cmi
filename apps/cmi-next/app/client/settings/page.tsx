import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/auth";
import { getClientPrefs } from "@/lib/client-portal/notifications";
import { ClientShell } from "../jobs/client-shell";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Constructed Matter" };

export default async function ClientSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const prefs = await getClientPrefs(session.contact.id);
  return <ClientShell><SettingsClient initial={{ ...prefs, phone: session.contact.phone }} /></ClientShell>;
}
