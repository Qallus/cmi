import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { toggleFavorite } from "@/lib/workspace/repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const result = await toggleFavorite(actor.id, id, body.favorite !== false);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update favorite.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
