// Trade partner list as an Excel-ready CSV (cost codes, 1099, contacts by role, documents).
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { tradePartnerCsv } from "@/lib/companies/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const hidden = new URL(request.url).searchParams.get("hidden") === "1";
    const csv = await tradePartnerCsv({ includeHidden: hidden });
    const name = `CMI-trade-partners-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
