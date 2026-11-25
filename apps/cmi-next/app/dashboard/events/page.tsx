import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageEvents, EVENTS_FLAG } from "@/lib/events/access";
import { listInvitationEvents } from "@/lib/events/data";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { EventsClient } from "./events-client";

export const metadata = { title: "Events — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canManageEvents(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(EVENTS_FLAG))) notFound();

  const [events, people, { event }] = await Promise.all([listInvitationEvents(), loadAssignableStaff(), searchParams]);
  return (
    <EventsClient
      initialEvents={events}
      staff={people.filter((p) => !["subcontractor", "vendor"].includes(p.role)).map((p) => ({ id: p.id, name: p.name, email: p.email }))}
      initialEventId={event ?? null}
    />
  );
}
