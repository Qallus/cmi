import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createBookingAppointment, createBookingEventPage, loadBookingData, updateBookingAppointment } from "@/lib/booking/data";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const data = await loadBookingData();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Bookings load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (body.resource === "event_page") {
      const eventPage = await createBookingEventPage(body);
      return NextResponse.json({ eventPage });
    }
    const appointment = await createBookingAppointment({ ...body, source: "dashboard" });
    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Booking create failed." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Appointment id is required.");
    const appointment = await updateBookingAppointment(id, body);
    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Booking update failed." }, { status: 400 });
  }
}
