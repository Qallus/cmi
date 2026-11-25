import { eventUrl, getInvitationEvent } from "@/lib/events/data";
import { invitationEmailHtml } from "@/lib/events/invite-email";
import { publicAppUrl } from "@/lib/twilio";

/** The invitation email as a guest would see it (with a sample name). */
export async function getEmailHtml(id: string): Promise<string> {
  const { event } = await getInvitationEvent(id);
  const app = publicAppUrl();
  return invitationEmailHtml(event, { guestName: "Alex Guest", rsvpUrl: eventUrl(event.slug), calendarUrl: `${app}/api/rsvp/${event.slug}/ics`, appUrl: app });
}
