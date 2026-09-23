// Edit or remove one timeline entry. The author can always change their own;
// admins can change anyone's. Edits are marked with edited_at.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getActivity, updateActivity, deleteActivity } from "@/lib/deals/data";

const ADMIN_ROLES = ["super_admin", "admin"];
type Ctx = { params: Promise<{ id: string; activityId: string }> };

async function authorize(request: Request, activityId: string) {
  const { staff } = await requireAdmin(request);
  const activity = await getActivity(activityId);
  if (!activity) throw new AuthError("Activity not found.", 404);
  const mine = activity.created_by === staff.id;
  if (!mine && !ADMIN_ROLES.includes(staff.role_slug)) {
    throw new AuthError("You can only edit timeline entries you posted.", 403);
  }
  return { staff, activity };
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { activityId } = await params;
    const { staff } = await authorize(request, activityId);
    const body = await request.json().catch(() => ({}));
    const patch: { summary?: string | null; body?: string | null; occurred_at?: string } = {};
    if ("summary" in body) patch.summary = body.summary;
    if ("body" in body) patch.body = body.body;
    if (typeof body.occurred_at === "string" && body.occurred_at) patch.occurred_at = body.occurred_at;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    return NextResponse.json(await updateActivity(activityId, patch, { id: staff.id }));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { activityId } = await params;
    await authorize(request, activityId);
    await deleteActivity(activityId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
