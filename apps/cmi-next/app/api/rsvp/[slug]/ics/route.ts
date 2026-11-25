// "Add to calendar" for a live invitation.
import { isFeatureEnabled } from "@/lib/flags";
import { EVENTS_FLAG } from "@/lib/events/access";
import { eventUrl, loadPublicInvitation } from "@/lib/events/data";
import { buildIcs } from "@/lib/events/ics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await isFeatureEnabled(EVENTS_FLAG)) || !/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("Not found", { status: 404 });
  const event = await loadPublicInvitation(slug);
  if (!event) return new Response("Not found", { status: 404 });
  const token = new URL(req.url).searchParams.get("i");
  const ics = buildIcs({ ...event, url: eventUrl(event.slug, token && /^[a-f0-9]{32}$/.test(token) ? token : null) });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
