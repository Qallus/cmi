import { NextResponse } from "next/server";
import { loadAppointmentTypes } from "@/lib/booking/data";

export async function GET() {
  try {
    const appointmentTypes = await loadAppointmentTypes();
    return NextResponse.json({ appointmentTypes });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Appointment types load failed." }, { status: 500 });
  }
}
