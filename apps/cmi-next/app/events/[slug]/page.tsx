import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicEventPage } from "@/lib/booking/data";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { EventRegistrationClient } from "./event-registration-client";
import { isFeatureEnabled } from "@/lib/flags";
import { EVENTS_FLAG } from "@/lib/events/access";
import { isRsvpToken } from "@/lib/events/design";
import { loadPublicGuests, loadPublicInvitation, openPersonalRsvp, rsvpClosed } from "@/lib/events/data";
import { InvitationPage } from "@/components/events/invitation-page";
import { turnstileSiteKey } from "@/lib/spam/turnstile";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ i?: string }> };

async function invitationFor(slug: string) {
  if (!(await isFeatureEnabled(EVENTS_FLAG))) return null;
  return loadPublicInvitation(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const invite = await invitationFor(slug).catch(() => null);
  if (!invite) return {};
  const description = invite.design.message_heading || invite.summary || "You're invited.";
  // Personal links carry a token; keep invitations out of search results.
  return { title: `${invite.title} | Constructed Matter`, description, robots: { index: false, follow: false }, openGraph: { title: invite.title, description } };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;

  const invite = await invitationFor(slug).catch(() => null);
  if (invite) {
    const { i } = await searchParams;
    const [guests, rsvp] = await Promise.all([
      loadPublicGuests(invite),
      isRsvpToken(i) ? openPersonalRsvp(invite, i) : Promise.resolve(null),
    ]);
    return (
      <InvitationPage
        event={invite}
        guests={guests}
        rsvp={rsvp}
        closed={rsvpClosed(invite)}
        turnstileSiteKey={invite.access === "link" ? turnstileSiteKey() : null}
      />
    );
  }

  const eventPage = await loadPublicEventPage(slug).catch(() => null);
  // An invitation with the feature turned off must not fall through to the registration page.
  if (!eventPage || (eventPage as { kind?: string }).kind === "invitation") notFound();
  return (
    <>
      <SiteHeader />
      <EventRegistrationClient eventPage={eventPage} />
      <SiteFooter />
    </>
  );
}
