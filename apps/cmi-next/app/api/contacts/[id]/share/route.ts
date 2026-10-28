// Send a contact's card + link to teammates: { channel: "email" | "sms" | "dm", recipient_ids, note }.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { shareContact, ContactShareError } from "@/lib/contacts/share";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const recipient_ids = Array.isArray(body?.recipient_ids) ? body.recipient_ids.filter((v: unknown): v is string => typeof v === "string") : [];
    const result = await shareContact(id, { channel: body?.channel, recipient_ids, note: typeof body?.note === "string" ? body.note : null },
      { id: staff.id, name: staff.display_name ?? null });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as ContactShareError | AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
