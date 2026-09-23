// Send a deal summary + link to staff: { channel: "email" | "sms" | "dm", recipient_ids, note }.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { shareDeal, DealShareError } from "@/lib/deals/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff, user } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't share deals.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const recipient_ids = Array.isArray(body?.recipient_ids)
      ? body.recipient_ids.filter((v: unknown): v is string => typeof v === "string")
      : [];
    const result = await shareDeal(
      id,
      { channel: body?.channel, recipient_ids, note: typeof body?.note === "string" ? body.note : null },
      { id: staff.id, name: user.email ?? null },
    );
    return NextResponse.json(result);
  } catch (err) {
    const e = err as DealShareError | AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
