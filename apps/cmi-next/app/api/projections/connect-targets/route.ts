// Jobs / deals / Pre-Con opportunities a projection can connect to (?kind=).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { listConnectTargets, type ConnectKind } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    const kind = new URL(request.url).searchParams.get("kind") as ConnectKind | null;
    if (!kind || !["job", "deal", "opportunity"].includes(kind)) return NextResponse.json({ error: "kind must be job, deal or opportunity." }, { status: 400 });
    return NextResponse.json(await listConnectTargets(kind));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
