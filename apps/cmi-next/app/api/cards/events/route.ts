// Public analytics tracking for business cards — no auth.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/business-cards/data";
import type { EventType } from "@/lib/business-cards/types";

const VALID: EventType[] = [
  "view", "share", "like", "qr_scan", "nfc_tap",
  "link_click", "copy_link", "save_contact", "lead_submit",
];

function deviceFromUA(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    | { cardId?: string; slug?: string; eventType?: EventType; linkId?: string; source?: string }
    | null;
  if (!body?.eventType || !VALID.includes(body.eventType)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  let cardId = body.cardId;
  if (!cardId && body.slug) {
    const { data } = await getSupabaseAdmin()
      .from("business_cards").select("id").eq("slug", body.slug).maybeSingle();
    cardId = data?.id;
  }
  if (!cardId) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const ua = request.headers.get("user-agent") || "";
  try {
    await recordEvent({
      cardId,
      eventType: body.eventType,
      linkId: body.linkId ?? null,
      source: body.source,
      deviceType: deviceFromUA(ua),
      referrer: request.headers.get("referer"),
      userAgent: ua.slice(0, 400),
    });
  } catch {
    // Never block the public page on analytics failure.
  }
  return NextResponse.json({ ok: true });
}
