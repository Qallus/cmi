import { NextResponse } from "next/server";
import { createBookingAppointment } from "@/lib/booking/data";
import { recordBookingSmsConsent } from "@/lib/messaging/booking-consent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const appointment = await createBookingAppointment({ ...body, source: "public" });

    // Log the consent behind the SMS checkbox. Logged after the appointment so
    // a consent-store hiccup can't cost someone their booking.
    if (body?.sms_consent && body?.phone) {
      await recordBookingSmsConsent(request, {
        phone: body.phone,
        person: {
          firstName: body.first_name ?? null,
          lastName: body.last_name ?? null,
          email: body.email ?? null,
          company: body.company_name ?? null,
        },
        sourceUrl: body?.source_url ?? null,
        recordType: "appointment",
        recordId: appointment?.id ?? null,
      });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Appointment request failed." }, { status: 400 });
  }
}
