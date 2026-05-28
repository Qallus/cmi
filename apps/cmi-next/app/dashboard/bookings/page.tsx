import { loadBookingData } from "@/lib/booking/data";
import { getDemoBookingData } from "@/lib/booking/demo-data";
import { BookingsClient } from "./bookings-client";

export default async function BookingsPage() {
  try {
    const data = await loadBookingData();
    return <BookingsClient initialData={data} demoMode={false} />;
  } catch (error) {
    return <BookingsClient initialData={getDemoBookingData()} demoMode={true} setupMessage={error instanceof Error ? error.message : "Bookings are running in demo mode."} />;
  }
}
