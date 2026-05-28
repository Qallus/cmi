import { loadAppointmentTypes } from "@/lib/booking/data";
import { demoAppointmentTypes } from "@/lib/booking/demo-data";
import { PublicBookingClient } from "./public-booking-client";

export default async function BookPage() {
  try {
    const appointmentTypes = await loadAppointmentTypes();
    return <PublicBookingClient appointmentTypes={appointmentTypes} demoMode={false} />;
  } catch (error) {
    return <PublicBookingClient appointmentTypes={demoAppointmentTypes} demoMode={true} setupMessage={error instanceof Error ? error.message : "Booking is running in demo mode."} />;
  }
}
