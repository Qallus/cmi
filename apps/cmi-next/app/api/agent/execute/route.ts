// Executes a confirmed pending action (delete or send) that Bolt staged.
import { NextResponse, type NextRequest } from "next/server";
import { requireBolt, boltErrorResponse } from "@/lib/agent/guard";
import { executePending } from "@/lib/agent/tools";
import type { PendingAction, StaffContext } from "@/lib/agent/types";

export async function POST(req: NextRequest) {
  let ctx: StaffContext;
  try {
    ({ ctx } = await requireBolt(req));
  } catch (err) {
    return boltErrorResponse(err);
  }

  const body = await req.json().catch(() => null) as { action?: PendingAction } | null;
  if (!body?.action) return NextResponse.json({ error: "action is required." }, { status: 400 });

  const result = await executePending(body.action, ctx);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ result });
}
