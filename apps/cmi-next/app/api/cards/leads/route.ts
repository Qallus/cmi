// Public lead capture ("Send me your info") — no auth.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createLead, recordEvent } from "@/lib/business-cards/data";
import { runLeadAutomations } from "@/lib/business-cards/notify";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    | { cardId?: string; slug?: string; name?: string; email?: string; phone?: string;
        company?: string; message?: string; preferredContact?: string }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const cardSelect = "id, slug, display_name, card_name, staff_user_id, automations";
  const lookup = body.cardId
    ? sb.from("business_cards").select(cardSelect).eq("id", body.cardId).maybeSingle()
    : body.slug
      ? sb.from("business_cards").select(cardSelect).eq("slug", body.slug).maybeSingle()
      : null;
  const card = lookup ? (await lookup).data : null;
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const hasContent = [body.name, body.email, body.phone, body.company, body.message].some((v) => String(v || "").trim());
  if (!hasContent) return NextResponse.json({ error: "Please fill in at least one field." }, { status: 400 });

  try {
    await createLead({
      cardId: card.id,
      ownerStaffId: card.staff_user_id ?? null,
      name: body.name, email: body.email, phone: body.phone,
      company: body.company, message: body.message, preferredContact: body.preferredContact,
      payload: { ...body },
    });
    await recordEvent({ cardId: card.id, eventType: "lead_submit", source: "public_card" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not submit." }, { status: 500 });
  }

  // Fire automations (email/SMS) — best-effort, never blocks the response status.
  await runLeadAutomations(card, body).catch(() => {});

  return NextResponse.json({ ok: true });
}
