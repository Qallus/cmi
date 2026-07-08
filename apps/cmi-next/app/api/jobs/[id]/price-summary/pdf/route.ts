// Server-rendered CMI-branded Job Price Summary PDF (Node runtime).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob, buildPriceSummary } from "@/lib/jobs/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { PriceSummaryPdf } from "@/components/pdf/price-summary-pdf";
import { primaryClient } from "@/lib/jobs/pdf-helpers";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const [job, summary, logo] = await Promise.all([getJob(id), buildPriceSummary(id), getBrandLogoDataUri()]);
    if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const buffer = await renderPdf(createElement(PriceSummaryPdf, { summary, client: primaryClient(job), logo }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="price-summary-${(job.job_number ?? "job").replace(/[^a-z0-9._-]+/gi, "_")}.pdf"`,
      },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
