// Download the invitation as one self-contained HTML file to host anywhere.
// RSVPs from it still post back to CMI.
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { getInvitationEvent } from "@/lib/events/data";
import { exportInvitationHtml } from "@/lib/events/export";
import { publicAppUrl } from "@/lib/twilio";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEvents(req);
    const { id } = await params;
    const { event } = await getInvitationEvent(id);
    const html = exportInvitationHtml(event, publicAppUrl());
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.slug}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return eventErrorResponse(err);
  }
}
