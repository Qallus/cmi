// Public lead capture ("Send me your info") — no auth.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createLead, recordEvent } from "@/lib/business-cards/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    | { cardId?: string; slug?: string; name?: string; email?: string; phone?: string;
        company?: string; message?: string; preferredContact?: string }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  let cardId = body.cardId;
  let ownerStaffId: string | null = null;
  const sb = getSupabaseAdmin();

  if (!cardId && body.slug) {
    const { data } = await sb.from("business_cards").select("id, staff_user_id").eq("slug", body.slug).maybeSingle();
    cardId = data?.id;
    ownerStaffId = data?.staff_user_id ?? null;
  } else if (cardId) {
    const { data } = await sb.from("business_cards").select("staff_user_id").eq("id", cardId).maybeSingle();
    ownerStaffId = data?.staff_user_id ?? null;
  }
  if (!cardId) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const hasContent = [body.name, body.email, body.phone, body.company, body.message].some((v) => String(v || "").trim());
  if (!hasContent) return NextResponse.json({ error: "Please fill in at least one field." }, { status: 400 });

  try {
    await createLead({
      cardId,
      ownerStaffId,
      name: body.name, email: body.email, phone: body.phone,
      company: body.company, message: body.message, preferredContact: body.preferredContact,
      payload: { ...body },
    });
    await recordEvent({ cardId, eventType: "lead_submit", source: "public_card" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not submit." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
