import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_REMINDER_DAYS } from "@/lib/schedules/reminders";

// The job's schedule settings (Phase 2 Step 6): how many working days before a
// task starts its staff assignees are reminded (0 = off).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("jobs").select("schedule_reminder_days").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ reminder_days: DEFAULT_REMINDER_DAYS, available: false });
    return NextResponse.json({ reminder_days: (data?.schedule_reminder_days as number | null) ?? DEFAULT_REMINDER_DAYS, available: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canManageSchedules(staff.role_slug)) return NextResponse.json({ error: "Only Admins and Project Managers change this." }, { status: 403 });
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as { reminder_days?: unknown };
    const n = Math.round(Number(b.reminder_days));
    if (!Number.isFinite(n) || n < 0 || n > 30) return NextResponse.json({ error: "Use 0 to 30 working days (0 turns reminders off)." }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("jobs").update({ schedule_reminder_days: n }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ reminder_days: n });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
