import { NextResponse } from "next/server";
import { requireClient, ClientAuthError } from "@/lib/client-portal/auth";
import { getClientPrefs, updateClientPrefs } from "@/lib/client-portal/notifications";

export async function GET(request: Request) {
  try {
    const { contact } = await requireClient(request);
    return NextResponse.json({ ...(await getClientPrefs(contact.id)), phone: contact.phone });
  } catch (err) { const e = err as ClientAuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const { contact } = await requireClient(request);
    const body = await request.json() as { email_enabled?: boolean; sms_enabled?: boolean };
    const patch: { email_enabled?: boolean; sms_enabled?: boolean } = {};
    if (typeof body.email_enabled === "boolean") patch.email_enabled = body.email_enabled;
    if (typeof body.sms_enabled === "boolean") patch.sms_enabled = body.sms_enabled;
    return NextResponse.json(await updateClientPrefs(contact.id, patch));
  } catch (err) { const e = err as ClientAuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
}
