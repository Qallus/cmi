import { loadAppointmentTypes } from "@/lib/booking/data";
import { demoAppointmentTypes } from "@/lib/booking/demo-data";
import { ContactFab } from "@/components/site/contact-fab";
import { SiteHeader } from "@/components/site/site-header";
import { PublicBookingClient } from "./public-booking-client";

export default async function BookPage() {
  try {
    const appointmentTypes = await loadAppointmentTypes();
    return (
      <>
        <SiteHeader />
        <PublicBookingClient appointmentTypes={appointmentTypes} demoMode={false} />
        <ContactFab />
      </>
    );
  } catch (error) {
    return (
      <>
        <SiteHeader />
        <PublicBookingClient appointmentTypes={demoAppointmentTypes} demoMode={true} setupMessage={error instanceof Error ? error.message : "Booking is running in demo mode."} />
        <ContactFab />
      </>
    );
  }
}
