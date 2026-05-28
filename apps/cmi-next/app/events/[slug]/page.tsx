import { notFound } from "next/navigation";
import { loadPublicEventPage } from "@/lib/booking/data";
import { EventRegistrationClient } from "./event-registration-client";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const eventPage = await loadPublicEventPage(slug);
    return <EventRegistrationClient eventPage={eventPage} />;
  } catch {
    notFound();
  }
}
