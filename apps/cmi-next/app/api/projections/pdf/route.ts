// Management PDF of the Projections grid (landscape). Same filters as the page:
// ?start=YYYY-MM&scope=&status=&pm=&sup=&allocation=&flag=
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { loadBoard } from "@/lib/projections/data";
import { filterRows, summarize, NO_FILTERS, type ProjectionFilters } from "@/lib/projections/calc";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { ProjectionsPdf } from "@/components/pdf/projections-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    const q = new URL(request.url).searchParams;
    const scope = q.get("scope");
    const filters: ProjectionFilters = {
      ...NO_FILTERS,
      scope: scope === "committed" || scope === "potential" ? scope : "all",
      status: q.get("status") ?? "", pm: q.get("pm") ?? "", sup: q.get("sup") ?? "",
      allocation: q.get("allocation") ?? "", flag: q.get("flag") ?? "",
    };
    const [board, logo] = await Promise.all([loadBoard({ start: q.get("start") }), getBrandLogoDataUri()]);
    const rows = filterRows(board.rows, filters, board.currentMonth);
    const view = summarize(rows, board.window, board.currentMonth, board.today);
    const active = Object.entries(filters).filter(([k, v]) => v && !(k === "scope" && v === "all")).map(([k, v]) => `${k}: ${v}`);
    const buffer = await renderPdf(createElement(ProjectionsPdf, {
      rows, totals: view.totals, window: board.window, summary: view.summary, anyActuals: view.anyActuals,
      currentMonth: board.currentMonth, filterNote: active.length ? `Filtered — ${active.join(", ")}` : null, logo,
    }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="projections-${board.window[0].slice(0, 7)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
