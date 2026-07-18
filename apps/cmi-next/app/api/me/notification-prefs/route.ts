// Current staff member's broadcast opt-in/out.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { broadcastsEnabled, setBroadcastsEnabled } from "@/lib/broadcasts/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    return NextResponse.json({ broadcasts_enabled: await broadcastsEnabled("staff", staff.id) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { broadcasts_enabled?: boolean };
    if (typeof body.broadcasts_enabled !== "boolean") return NextResponse.json({ error: "broadcasts_enabled is required." }, { status: 400 });
    await setBroadcastsEnabled("staff", staff.id, body.broadcasts_enabled);
    return NextResponse.json({ broadcasts_enabled: body.broadcasts_enabled });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}
