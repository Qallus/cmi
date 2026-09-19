// Connect a projection to a job / deal / Pre-Con opportunity (POST
// { kind, target_id }) or disconnect one (DELETE ?kind=).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { connectProjection, disconnectProjection, loadDetail, type ConnectKind } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const KINDS: ConnectKind[] = ["job", "deal", "opportunity"];

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!KINDS.includes(body?.kind) || typeof body?.target_id !== "string") return NextResponse.json({ error: "kind and target_id are required." }, { status: 400 });
    await connectProjection(id, body.kind, body.target_id, actor);
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const kind = new URL(request.url).searchParams.get("kind") as ConnectKind | null;
    if (!kind || !KINDS.includes(kind)) return NextResponse.json({ error: "kind is required." }, { status: 400 });
    await disconnectProjection(id, kind, actor);
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
