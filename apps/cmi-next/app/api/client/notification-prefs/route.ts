// Current client's broadcast opt-in/out (separate from email/sms prefs).
import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";
import { broadcastsEnabled, setBroadcastsEnabled } from "@/lib/broadcasts/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { contact } = await requireClient(request);
    return NextResponse.json({ broadcasts_enabled: await broadcastsEnabled("client", contact.id) });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { contact } = await requireClient(request);
    const body = (await request.json().catch(() => ({}))) as { broadcasts_enabled?: boolean };
    if (typeof body.broadcasts_enabled !== "boolean") return NextResponse.json({ error: "broadcasts_enabled is required." }, { status: 400 });
    await setBroadcastsEnabled("client", contact.id, body.broadcasts_enabled);
    return NextResponse.json({ broadcasts_enabled: body.broadcasts_enabled });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}
