// 11×17 Gantt print (Schedules Phase 2 Step 8): ?view=full|lookahead|milestones|client
// &baseline=1 draws the current baseline under each bar (not on the client print).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { getSchedule, listItems, listPhases, listBaselines, scopeLabel } from "@/lib/schedules/data";
import { getJob } from "@/lib/jobs/data";
import { primaryClient } from "@/lib/jobs/pdf-helpers";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { todayAZ } from "@/lib/schedules/progress";
import { printRows, printScale, GANTT_PRINT_VIEWS, type GanttPrintView } from "@/lib/schedules/gantt-print";
import { GanttPdf } from "@/components/pdf/gantt-pdf";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const url = new URL(request.url);
    const v = url.searchParams.get("view");
    const view: GanttPrintView = GANTT_PRINT_VIEWS.some((x) => x.key === v) ? (v as GanttPrintView) : "full";
    const schedule = await getSchedule(id);
    if (!schedule) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const [items, phases, job, logo, baselines, { data: row }] = await Promise.all([
      listItems({ scheduleId: id }), listPhases(id), schedule.job_id ? getJob(schedule.job_id) : null, getBrandLogoDataUri(), listBaselines(id),
      getSupabaseAdmin().from("job_schedules").select("status_date, engine_finish").eq("id", id).maybeSingle(),
    ]);
    const today = todayAZ();
    const rows = printRows(items, phases, view, today);
    const scale = printScale(rows, view, today);
    const lastEnd = items.reduce<string | null>((m, i) => { const e = i.end_date ?? i.start_date; return e && (!m || e > m) ? e : m; }, null);
    const project = job
      ? { name: job.job_name, number: job.job_number ?? null, address: job.full_address ?? null, client: primaryClient(job)?.name ?? null }
      : { name: schedule.scope_id ? await scopeLabel({ type: schedule.scope_type ?? "job", id: schedule.scope_id }) : "Project", number: null, address: null, client: null };
    const buffer = await renderPdf(createElement(GanttPdf, {
      logo, view, rows, scale, project, showBaseline: url.searchParams.get("baseline") === "1",
      schedule: { name: schedule.name, status_date: row?.status_date ?? null, baseline: baselines[0]?.name ?? null, finish: row?.engine_finish ?? schedule.projected_completion ?? lastEnd },
    }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${schedule.name.replace(/[^a-z0-9._-]+/gi, "_")}-gantt-11x17-${view}.pdf"` },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
