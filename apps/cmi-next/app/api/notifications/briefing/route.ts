// Dashboard → Notifications → Morning Briefing. Super Admin only.
//
//   GET  → saved settings, the staff list (with email opt-outs), recent sends
//   PUT  → save settings (automatic send on/off, audience, AI summary)
//   POST → send now to everyone or a chosen list
import { NextResponse } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadBriefingStaff } from "@/lib/briefing/build";
import { loadBriefingSettings, saveBriefingSettings, type BriefingSettings } from "@/lib/briefing/settings";
import { emailOptOuts, loadBriefingHistory, runBriefings } from "@/lib/briefing/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A manual send to the whole team writes one AI summary per person.
export const maxDuration = 300;

function fail(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const [settings, staff, history] = await Promise.all([loadBriefingSettings(), loadBriefingStaff(), loadBriefingHistory()]);
    const { data: statuses } = await getSupabaseAdmin().from("staff_users").select("id, status").in("id", staff.map((s) => s.id));
    const status = new Map(((statuses ?? []) as { id: string; status: string }[]).map((s) => [s.id, s.status]));
    const off = await emailOptOuts(staff.map((s) => s.id));
    return NextResponse.json({
      settings,
      staff: staff
        .map((s) => ({ id: s.id, name: (s.display_name ?? "").trim() || s.email, email: s.email, role: s.role_slug, status: status.get(s.id) ?? "active", emailOff: off.has(s.id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      history,
      envOverride: (process.env.BRIEFING_AUDIENCE ?? "").trim() || null,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { staff } = await requireSuperAdmin(request);
    const body = (await request.json().catch(() => ({}))) as Partial<BriefingSettings>;
    return NextResponse.json({ settings: await saveBriefingSettings(body, staff.id) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireSuperAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { recipientIds?: string[] | "all"; force?: boolean; includeAi?: boolean };
    const recipientIds = body.recipientIds === "all" ? "all" : Array.isArray(body.recipientIds) ? body.recipientIds : [];
    if (recipientIds !== "all" && !recipientIds.length) return NextResponse.json({ error: "Choose at least one person." }, { status: 400 });
    const { data: me } = await getSupabaseAdmin().from("staff_users").select("display_name, email").eq("id", staff.id).maybeSingle();
    const result = await runBriefings({
      trigger: "manual",
      recipientIds,
      force: !!body.force,
      includeAi: typeof body.includeAi === "boolean" ? body.includeAi : undefined,
      actor: { id: staff.id, name: me?.display_name || me?.email || user.email || "Super Admin" },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return fail(err);
  }
}
