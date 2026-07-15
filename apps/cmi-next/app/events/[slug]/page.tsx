import { notFound } from "next/navigation";
import { loadPublicEventPage } from "@/lib/booking/data";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { EventRegistrationClient } from "./event-registration-client";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const eventPage = await loadPublicEventPage(slug);
    return (
      <>
        <SiteHeader />
        <EventRegistrationClient eventPage={eventPage} />
        <SiteFooter />
      </>
    );
  } catch {
    notFound();
  }
}
