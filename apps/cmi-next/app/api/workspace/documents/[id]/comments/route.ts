import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { createComment } from "@/lib/workspace/comments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
    const result = await createComment(
      {
        documentId: id,
        body: text,
        quote: typeof body.quote === "string" ? body.quote : null,
        parentId: body.parentId || null,
        mentionedUserIds: Array.isArray(body.mentionedUserIds) ? body.mentionedUserIds : [],
      },
      actor.id,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add comment.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
