// Server-rendered CMI-branded Schedule PDF (Node runtime).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { getSchedule, listItems, listPhases } from "@/lib/schedules/data";
import { getJob } from "@/lib/jobs/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { primaryClient } from "@/lib/jobs/pdf-helpers";
import { SchedulePdf } from "@/components/pdf/schedule-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const schedule = await getSchedule(id);
    if (!schedule) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const [items, phases, job, logo] = await Promise.all([
      listItems({ scheduleId: id }), listPhases(id), getJob(schedule.job_id), getBrandLogoDataUri(),
    ]);
    const jobLite = job ? { job_number: job.job_number, job_name: job.job_name, full_address: job.full_address } : { job_number: null, job_name: "Job" };
    const buffer = await renderPdf(createElement(SchedulePdf, { schedule, items, phases, job: jobLite, client: job ? (primaryClient(job)?.name ?? null) : null, logo }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${schedule.name.replace(/[^a-z0-9._-]+/gi, "_")}-schedule.pdf"`,
      },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
