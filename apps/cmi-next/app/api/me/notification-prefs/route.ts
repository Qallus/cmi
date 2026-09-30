// The current staff member's notification switches.
//
// Was broadcasts-only. Email and push were added when directed notifications
// arrived: the branded emails link here as "Notification settings", so the
// switches have to actually exist and actually be honoured — notifyStaff reads
// the same row before sending.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

const KEYS = ["broadcasts_enabled", "email_enabled", "push_enabled"] as const;
type Key = (typeof KEYS)[number];
type Prefs = Record<Key, boolean>;

// No row means everything on, so a new staff member is loud by default rather
// than silently opted out of things nobody ever switched on for them.
const DEFAULTS: Prefs = { broadcasts_enabled: true, email_enabled: true, push_enabled: true };

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const { data } = await getSupabaseAdmin()
      .from("notification_prefs")
      .select(KEYS.join(", "))
      .eq("user_kind", "staff")
      .eq("user_id", staff.id)
      .maybeSingle();
    return NextResponse.json({ ...DEFAULTS, ...((data ?? {}) as Partial<Prefs>) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as Partial<Prefs>;

    const patch: Partial<Prefs> = {};
    for (const key of KEYS) if (typeof body[key] === "boolean") patch[key] = body[key];
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("notification_prefs")
      .upsert({ user_kind: "staff", user_id: staff.id, ...patch }, { onConflict: "user_kind,user_id" })
      .select(KEYS.join(", "))
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ...DEFAULTS, ...((data ?? {}) as Partial<Prefs>) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}
