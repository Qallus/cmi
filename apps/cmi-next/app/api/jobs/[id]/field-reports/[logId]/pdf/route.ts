// The finished daily report as a branded PDF (internal notes left out).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob } from "@/lib/jobs/data";
import { getJobLogFor } from "@/lib/daily-logs/data";
import { normalizeSections } from "@/lib/daily-logs/sections";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DailyReportPdf } from "@/components/pdf/daily-report-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id, logId } = await params;
    const log = await getJobLogFor(id, logId, staff.id);
    if (!log) return NextResponse.json({ error: "Daily log not found." }, { status: 404 });
    const r = log as typeof log & { log_number?: number | null; status?: string; submitted_at?: string | null; submitted_by?: string | null; sections?: unknown };
    const [job, logo, who] = await Promise.all([
      getJob(id), getBrandLogoDataUri(),
      r.submitted_by ? getSupabaseAdmin().from("staff_users").select("display_name").eq("id", r.submitted_by).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    const buffer = await renderPdf(createElement(DailyReportPdf, {
      job: { job_number: job.job_number, job_name: job.job_name, full_address: job.full_address },
      log: { log_number: r.log_number ?? null, log_date: log.log_date, status: r.status ?? "draft", weather: log.weather, temperature: log.temperature, submitted_at: r.submitted_at ?? null },
      sections: normalizeSections(r.sections), photos: (log.photos ?? []).filter((u) => /^https?:\/\//.test(u)),
      logo, submittedBy: (who.data as { display_name?: string | null } | null)?.display_name ?? null,
    }));
    const name = `${(job.job_number || job.job_name).replace(/[^a-z0-9._-]+/gi, "_")}_Daily_Log_${r.log_number ?? ""}_${log.log_date}.pdf`;
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
