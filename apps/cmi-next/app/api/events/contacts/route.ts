// Contact search for the Events guest picker.
import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireEvents(req);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%,()]/g, " ").slice(0, 80);
    if (q.length < 2) return NextResponse.json({ contacts: [] });
    const { data, error } = await getSupabaseAdmin()
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, type")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      contacts: (data ?? []).map((c) => ({
        id: c.id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact",
        email: c.email,
        phone: c.phone,
        detail: [c.type, c.company].filter(Boolean).join(" · "),
      })),
    });
  } catch (err) {
    return eventErrorResponse(err);
  }
}
