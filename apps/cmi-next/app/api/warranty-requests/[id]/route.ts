// Update a warranty request (staff triage: status, assignment, notes).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateWarrantyRequest } from "@/lib/pipeline/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't update warranty requests.` }, { status: 403 });
    }
    const { id } = await params;
    return NextResponse.json(await updateWarrantyRequest(id, await request.json()));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
