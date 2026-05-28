import { NextResponse } from "next/server";
import { registerForEventPage } from "@/lib/booking/data";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const appointment = await registerForEventPage(slug, await request.json());
    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Event registration failed." }, { status: 400 });
  }
}
