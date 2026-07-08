// Server-rendered CMI-branded Invoice PDF (Node runtime).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob } from "@/lib/jobs/data";
import { getInvoice } from "@/lib/invoices/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";
import { primaryClient } from "@/lib/jobs/pdf-helpers";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; invId: string }> }) {
  try {
    await requireAdmin(request);
    const { id, invId } = await params;
    const [job, invoice, logo] = await Promise.all([getJob(id), getInvoice(invId), getBrandLogoDataUri()]);
    if (!job || !invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const buffer = await renderPdf(createElement(InvoicePdf, { invoice, job, client: primaryClient(job), logo }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(invoice.invoice_number ?? "invoice").replace(/[^a-z0-9._-]+/gi, "_")}.pdf"`,
      },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
