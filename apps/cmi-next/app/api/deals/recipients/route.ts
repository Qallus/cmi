// Who a deal can be shared with: active staff who can open the Pipeline.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { listShareRecipients } from "@/lib/deals/notify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't share deals.` }, { status: 403 });
    }
    return NextResponse.json({ me: staff.id, recipients: await listShareRecipients() });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
