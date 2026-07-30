// Bulk-update contacts (e.g. change type Lead → Client, or archive many).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CONTACT_TYPES, type ContactType } from "@/lib/contacts/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    patch?: { type?: ContactType; status?: string };
  };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "No contacts selected." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.patch?.type !== undefined) {
    if (!CONTACT_TYPES.includes(body.patch.type)) return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    patch.type = body.patch.type;
  }
  if (body.patch?.status !== undefined) {
    if (!["active", "inactive", "archived"].includes(body.patch.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = body.patch.status;
  }
  if (Object.keys(patch).length === 1) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("contacts")
    .update(patch)
    .in("id", ids)
    .select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data ?? [] });
}
