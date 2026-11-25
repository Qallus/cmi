// Send invitations. { channel, scope, rsvpIds?, dryRun? }
// dryRun returns who would get it and who's skipped (and why), without sending.
// { test: true } emails one copy to the signed-in staff member.
import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { planInvites, publicPlan, sendInvites, sendTestInvite, type SendChannel, type SendScope } from "@/lib/events/send";
import { EventError } from "@/lib/events/data";
import { getEmailHtml } from "./preview";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    return new Response(await getEmailHtml(id), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return eventErrorResponse(err);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { user, staff } = await requireEvents(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.test === true) {
      if (!user.email) throw new EventError("Your account has no email.");
      return NextResponse.json(await sendTestInvite(id, user.email, (staff.display_name as string | null) ?? null));
    }

    const channel = (body.channel === "sms" ? "sms" : "email") as SendChannel;
    const scope = (["unsent", "waiting", "selected"].includes(String(body.scope)) ? body.scope : "unsent") as SendScope;
    const rsvpIds = Array.isArray(body.rsvpIds) ? body.rsvpIds.filter((x): x is string => typeof x === "string") : [];

    if (body.dryRun !== false) return NextResponse.json({ plan: publicPlan(await planInvites(id, channel, scope, rsvpIds)) });
    return NextResponse.json(await sendInvites(id, channel, scope, rsvpIds));
  } catch (err) {
    return eventErrorResponse(err);
  }
}
