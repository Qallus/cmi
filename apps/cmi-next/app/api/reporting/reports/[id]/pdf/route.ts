// Branded PDF of one weekly meeting report.
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireReporting, reportingErrorResponse } from "@/lib/reporting/guard";
import { getReport } from "@/lib/reporting/data";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { MeetingReportPdf } from "@/components/pdf/meeting-report-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReporting(request);
    const { id } = await params;

    const [report, logo, staff] = await Promise.all([
      getReport(id),
      getBrandLogoDataUri(),
      loadAssignableStaff(),
    ]);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const buffer = await renderPdf(
      createElement(MeetingReportPdf, {
        report,
        logo,
        owners: staff.map((s) => ({ id: s.id, name: s.name })),
      }),
    );

    const filename = `weekly-workload-${report.meeting_date}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
