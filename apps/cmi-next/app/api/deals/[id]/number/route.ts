// Correct a deal's pipeline number and name together (see renameDeal).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { renameDeal, DealRenameError } from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit deals.` }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { job_number?: string; name?: string };
    return NextResponse.json(await renameDeal(id, { job_number: body.job_number ?? "", name: body.name ?? "" }, { id: staff.id, name: staff.display_name ?? undefined }));
  } catch (err) {
    if (err instanceof DealRenameError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message || "Couldn't save the number and name." }, { status: e.status ?? 500 });
  }
}
