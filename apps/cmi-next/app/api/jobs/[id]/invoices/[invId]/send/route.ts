// Email a branded invoice PDF to the job's client (lib/invoices/send.ts, shared
// with Claude's cmi_invoice_send). Node runtime (renders the PDF).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { sendInvoiceEmail, InvoiceSendError } from "@/lib/invoices/send";

export const runtime = "nodejs";
const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string; invId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id, invId } = await params;
    const body = await request.json().catch(() => ({})) as { to?: string };
    const r = await sendInvoiceEmail(id, invId, body.to ?? null);
    return NextResponse.json({ ok: true, id: r.id, to: r.to });
  } catch (err) {
    if (err instanceof InvoiceSendError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
