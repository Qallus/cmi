// Client submits a warranty request against their job (Warranty-status jobs).
import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, getJobPerms, ClientAuthError } from "@/lib/client-portal/auth";
import { createClientWarranty } from "@/lib/client-portal/data";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId } = await params;
    await assertJobAccess(contact.id, jobId);
    const perms = await getJobPerms(contact.id, jobId);
    if (perms.warranty_claims === false) return NextResponse.json({ error: "Warranty submissions are not enabled for your account." }, { status: 403 });

    const body = await request.json() as { request_title?: string; request_description?: string; category?: string; location_in_home?: string; priority?: string; photos?: string[] };
    if (!body?.request_title?.trim()) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    return NextResponse.json(await createClientWarranty(jobId, contact, { ...body, request_title: body.request_title.trim() }), { status: 201 });
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
