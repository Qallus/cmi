// Who a projection can be shared with: active Super Admin / Admin staff only.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { listShareRecipients } from "@/lib/projections/notify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await requireProjections(request);
    return NextResponse.json({ me: staff.id, recipients: await listShareRecipients() });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
