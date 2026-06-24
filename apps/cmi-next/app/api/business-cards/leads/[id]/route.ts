import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { deleteLead, getLeadOwner, updateLeadStatus } from "@/lib/business-cards/data";
import type { LeadStatus } from "@/lib/business-cards/types";

const ADMIN_ROLES = ["super_admin", "admin"];
const VALID: LeadStatus[] = ["new", "contacted", "qualified", "archived"];

async function authorize(request: Request, id: string) {
  const { staff } = await requireAdmin(request);
  const isAdmin = ADMIN_ROLES.includes(staff.role_slug);
  const lead = await getLeadOwner(id);
  if (!lead) throw new AuthError("Lead not found.", 404);
  if (!isAdmin && lead.owner_staff_id !== staff.id) {
    throw new AuthError("You can only manage leads for your own cards.", 403);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await authorize(request, id);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = await request.json().catch(() => null) as { status?: LeadStatus } | null;
  if (!body?.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  try {
    await updateLeadStatus(id, body.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await authorize(request, id);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  try {
    await deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 400 });
  }
}
