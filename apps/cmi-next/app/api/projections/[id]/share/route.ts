// Send a projection summary + link to Admins: { channel: "email" | "sms" | "dm", recipient_ids, note }.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { shareProjection } from "@/lib/projections/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const recipient_ids = Array.isArray(body?.recipient_ids) ? body.recipient_ids.filter((v: unknown): v is string => typeof v === "string") : [];
    return NextResponse.json(await shareProjection(id, { channel: body?.channel, recipient_ids, note: typeof body?.note === "string" ? body.note : null }, actor));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
