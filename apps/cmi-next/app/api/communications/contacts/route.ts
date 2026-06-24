// Lightweight contact list for the dialer's "quick send" / call-a-contact panel.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company")
    .order("last_activity", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contacts = (data ?? []).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unknown",
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
  }));

  return NextResponse.json({ contacts });
}
