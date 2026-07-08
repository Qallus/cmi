// Warranty requests. GET is staff-only (dashboard warranty tracking). POST is
// public so the client portal / website warranty form can submit a request tied
// back to a project (job number / opportunity) — see docs §6, §15.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadWarrantyRequests, createWarrantyRequest } from "@/lib/pipeline/data";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await loadWarrantyRequests());
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.request_title) {
      return NextResponse.json({ error: "Request title is required." }, { status: 400 });
    }
    // Public submission: only accept a known-safe subset of fields.
    const created = await createWarrantyRequest({
      opportunity_id: body.opportunity_id ?? null,
      job_number: body.job_number ?? null,
      contact_id: body.contact_id ?? null,
      submitted_by: body.submitted_by ?? null,
      submitter_email: body.submitter_email ?? null,
      submitter_phone: body.submitter_phone ?? null,
      request_title: body.request_title,
      request_description: body.request_description ?? null,
      location_in_home: body.location_in_home ?? null,
      priority: body.priority ?? "normal",
      photos: body.photos ?? null,
      documents: body.documents ?? null,
      status: "submitted",
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Submission failed." }, { status: 500 });
  }
}
