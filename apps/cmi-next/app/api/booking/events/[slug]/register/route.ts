import { NextResponse } from "next/server";
import { registerForEventPage } from "@/lib/booking/data";
import { recordBookingSmsConsent } from "@/lib/messaging/booking-consent";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const appointment = await registerForEventPage(slug, body);

    // Same consent record as the booking form — the checkbox is identical.
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
    return NextResponse.json({ message: error instanceof Error ? error.message : "Event registration failed." }, { status: 400 });
  }
}
