import { NextResponse } from "next/server";
import { createBookingAppointment } from "@/lib/booking/data";

export async function POST(request: Request) {
  try {
    const appointment = await createBookingAppointment({ ...(await request.json()), source: "public" });
    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Appointment request failed." }, { status: 400 });
  }
}
