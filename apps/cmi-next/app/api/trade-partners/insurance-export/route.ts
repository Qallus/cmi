// Master insurance tracking as a CSV: one row per coverage line, soonest expiry first.
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { insuranceTrackingCsv } from "@/lib/companies/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const csv = await insuranceTrackingCsv();
    const name = `CMI-insurance-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
