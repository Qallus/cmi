import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  loadContactSubmissions, updateContactSubmissionStatus,
  bulkUpdateSubmissionStatus, deleteContactSubmissions,
} from "@/lib/contact-submissions/data";
import type { ContactSubmissionStatus } from "@/lib/contact-submissions/types";

export async function GET() {
  try {
    const submissions = await loadContactSubmissions(500);
    return NextResponse.json(submissions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load submissions." },
      { status: 500 }
    );
  }
}

// Update status — single ({id,status}) or bulk ({ids,status}).
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json() as { id?: string; ids?: string[]; status: ContactSubmissionStatus };
    if (!body.status) return NextResponse.json({ error: "status is required." }, { status: 400 });
    if (body.ids?.length) {
      await bulkUpdateSubmissionStatus(body.ids, body.status);
    } else if (body.id) {
      await updateContactSubmissionStatus(body.id, body.status);
    } else {
      return NextResponse.json({ error: "id or ids is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Failed to update submission." }, { status: e.status ?? 500 });
  }
}

// Delete — single ({id}) or bulk ({ids}).
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json() as { id?: string; ids?: string[] };
    const ids = body.ids?.length ? body.ids : body.id ? [body.id] : [];
    if (!ids.length) return NextResponse.json({ error: "id or ids is required." }, { status: 400 });
    await deleteContactSubmissions(ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Failed to delete submission." }, { status: e.status ?? 500 });
  }
}
