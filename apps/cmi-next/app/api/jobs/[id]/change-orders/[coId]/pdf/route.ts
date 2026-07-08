// Server-rendered CMI-branded Change Order PDF (Node runtime).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob } from "@/lib/jobs/data";
import { getChangeOrder } from "@/lib/change-orders/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { ChangeOrderPdf } from "@/components/pdf/change-order-pdf";
import { primaryClient } from "@/lib/jobs/pdf-helpers";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; coId: string }> }) {
  try {
    await requireAdmin(request);
    const { id, coId } = await params;
    const [job, co, logo] = await Promise.all([getJob(id), getChangeOrder(coId), getBrandLogoDataUri()]);
    if (!job || !co) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const buffer = await renderPdf(createElement(ChangeOrderPdf, { co, job, client: primaryClient(job), logo }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(co.co_number ?? "change-order").replace(/[^a-z0-9._-]+/gi, "_")}.pdf"`,
      },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
