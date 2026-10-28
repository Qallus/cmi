// Bulk actions on selected contacts: change type / status / lead owner, add or
// remove tags (PATCH), or delete them (DELETE, Super Admin / Admin only).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CONTACT_TYPES, type ContactType } from "@/lib/contacts/types";
import { denyUnlessStaff } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const MAX = 1000;

function idsFrom(body: { ids?: unknown }): string[] {
  return Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
}

const cleanTags = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20);

export async function PATCH(request: Request) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    patch?: { type?: ContactType; status?: string; lead_owner?: string | null; tags_add?: string[] | string; tags_remove?: string[] | string };
  };
  const ids = idsFrom(body);
  if (ids.length === 0) return NextResponse.json({ error: "No contacts selected." }, { status: 400 });
  const p = body.patch ?? {};

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.type !== undefined) {
    if (!CONTACT_TYPES.includes(p.type)) return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    patch.type = p.type;
  }
  if (p.status !== undefined) {
    if (!["active", "inactive", "archived"].includes(p.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = p.status;
  }
  if (p.lead_owner !== undefined) patch.lead_owner = p.lead_owner ? String(p.lead_owner).slice(0, 120) : null;
  const add = cleanTags(p.tags_add);
  const remove = cleanTags(p.tags_remove).map((t) => t.toLowerCase());
  if (Object.keys(patch).length === 1 && !add.length && !remove.length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (Object.keys(patch).length > 1) {
    const { error } = await supabase.from("contacts").update(patch).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Tags differ per contact, so they're merged one row at a time.
  if (add.length || remove.length) {
    const { data: rows } = await supabase.from("contacts").select("id, tags").in("id", ids);
    for (const r of (rows ?? []) as { id: string; tags: string[] | null }[]) {
      const current = r.tags ?? [];
      const next = [...current.filter((t) => !remove.includes(t.toLowerCase())), ...add.filter((t) => !current.some((c) => c.toLowerCase() === t.toLowerCase()))];
      if (next.join("\u0000") !== current.join("\u0000")) await supabase.from("contacts").update({ tags: next, updated_at: patch.updated_at }).eq("id", r.id);
    }
  }
  const { data, error } = await supabase.from("contacts").select("*").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data ?? [] });
}

export async function DELETE(request: Request) {
  const denied = await denyUnlessStaff(["super_admin", "admin"]); if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = idsFrom(body);
  if (ids.length === 0) return NextResponse.json({ error: "No contacts selected." }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("contacts").delete().in("id", ids);
  if (error) return NextResponse.json({ error: `Couldn't delete: ${error.message}` }, { status: 500 });
  return NextResponse.json({ deleted: ids.length });
}
