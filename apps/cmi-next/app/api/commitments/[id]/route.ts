// One commitment: edit, reassign, mark done (evidence required), dismiss or
// reopen. Your own, or anyone's for Super Admin / Admin.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  dismissCommitment, getCommitment, reopenCommitment, resolveCommitment, updateCommitment,
} from "@/lib/commitments/data";
import { commitmentsError } from "@/lib/commitments/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const existing = await getCommitment(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const isAdmin = ["super_admin", "admin"].includes(staff.role_slug);
    const involved = [existing.owner_staff_id, existing.created_by, existing.waiting_on_staff_id].includes(staff.id);
    if (!isAdmin && !involved) throw new AuthError("That commitment belongs to someone else.", 403);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "update");
    const out = action === "resolve" ? await resolveCommitment(id, String(body.evidence ?? ""), staff)
      : action === "dismiss" ? await dismissCommitment(id, (body.reason as string) ?? null, staff)
      : action === "reopen" ? await reopenCommitment(id, staff)
      : await updateCommitment(id, (body.changes as Record<string, unknown>) ?? {}, staff);
    return NextResponse.json({ commitment: out.after });
  } catch (err) {
    return commitmentsError(err);
  }
}
