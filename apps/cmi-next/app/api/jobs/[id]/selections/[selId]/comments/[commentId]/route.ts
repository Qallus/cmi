import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { selectionOnJob } from "@/lib/job-selections/data";
import { setHandled, CommentsError } from "@/lib/selection-comments/data";

// Mark a client comment handled, or open again. Any staff member who can see it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; selId: string; commentId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id, selId, commentId } = await params;
    if (!(await selectionOnJob(selId, id))) return NextResponse.json({ error: "Selection not found on this job." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await setHandled(selId, commentId, staff.id, body.handled !== false));
  } catch (err) {
    if (err instanceof CommentsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
