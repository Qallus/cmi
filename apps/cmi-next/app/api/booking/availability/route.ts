import { NextRequest, NextResponse } from "next/server";
import { loadAvailabilitySlots } from "@/lib/booking/data";

export async function GET(request: NextRequest) {
  try {
    const appointmentTypeId = request.nextUrl.searchParams.get("appointment_type_id") || "";
    const date = request.nextUrl.searchParams.get("date") || "";
    const slots = await loadAvailabilitySlots(appointmentTypeId, date);
    return NextResponse.json({ date, slots });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Availability load failed." }, { status: 400 });
  }
}
