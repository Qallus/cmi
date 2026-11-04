import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules, canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ENGINE_FLAG, loadNetwork, recalcSchedule, switchMode } from "@/lib/schedules/engine";
import { contractVariance } from "@/lib/schedules/whatif";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { SchedulingMode } from "@/lib/schedules/types";

const MODES: SchedulingMode[] = ["legacy", "auto", "manual"];

type ContractRow = { id: string; title: string; contract_date: string; milestone_type: string | null; forecast: string | null; variance: number | null };

// GET: is the engine available, this schedule's mode, and (on the engine) its
// finish and critical tasks as of the last save.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const enabled = await isFeatureEnabled(ENGINE_FLAG);
    const { data } = await getSupabaseAdmin().from("job_schedules").select("scheduling_mode, status_date, engine_finish, engine_ran_at").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    const mode = (data.scheduling_mode ?? "legacy") as SchedulingMode;
    // Read what the last save stored rather than re-running the engine (fast).
    let summary: { finish: string | null; critical: { id: string }[]; loops: number; contract: ContractRow[] } | null = null;
    if (enabled && mode !== "legacy") {
      const sb = getSupabaseAdmin();
      const [{ data: crit }, { data: dated }] = await Promise.all([
        sb.from("schedule_items").select("id").eq("schedule_id", id).eq("is_critical", true).not("total_float", "is", null),
        sb.from("schedule_items").select("id, schedule_id, title, kind, start_date, end_date, contract_date, milestone_type").eq("schedule_id", id).not("contract_date", "is", null),
      ]);
      // Variance needs the work calendar, so only load it when something has a contract date.
      let contract: ContractRow[] = [];
      if (dated?.length) {
        const net = await loadNetwork(id);
        contract = dated.map((m) => ({
          id: m.id, title: m.title, contract_date: m.contract_date, milestone_type: m.milestone_type,
          forecast: m.kind === "milestone" ? m.start_date : m.end_date ?? m.start_date,
          variance: contractVariance(net, m),
        }));
      }
      summary = { finish: data.engine_finish ?? null, critical: (crit ?? []) as { id: string }[], loops: 0, contract };
    }
    return NextResponse.json({ enabled, mode, ...data, summary, canSwitch: canManageSchedules(staff.role_slug) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST { action: "switch", mode, keepDates?, dryRun? }: put the schedule on the
//   engine (auto / manual) or back to legacy. dryRun returns the preview.
// POST { action: "recalc", dryRun? }: run the engine and save.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = { id: staff.id };
    if (body.action === "switch") {
      if (!canManageSchedules(staff.role_slug)) return NextResponse.json({ error: "Only Admins and Project Managers change how a schedule's dates are worked out." }, { status: 403 });
      if (!MODES.includes(body.mode)) return NextResponse.json({ error: "mode must be legacy, auto or manual." }, { status: 400 });
      return NextResponse.json(await switchMode(id, body.mode, body.keepDates !== false, actor, { dryRun: body.dryRun === true }));
    }
    if (body.action === "recalc") {
      if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      return NextResponse.json(await recalcSchedule(id, actor, { dryRun: body.dryRun === true }));
    }
    return NextResponse.json({ error: "action must be switch or recalc." }, { status: 400 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
