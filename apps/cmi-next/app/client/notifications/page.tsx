import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/auth";
import { loadClientNotifications } from "@/lib/client-portal/notifications";
import { ClientShell } from "../jobs/client-shell";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — Constructed Matter" };

export default async function ClientNotificationsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const notifications = await loadClientNotifications(session.contact.id);
  return <ClientShell><NotificationsClient initial={notifications} /></ClientShell>;
}
