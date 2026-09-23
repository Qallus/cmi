// Verify, reject or correct one compliance document.
import { NextResponse } from "next/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { updateDocument, documentUrl } from "@/lib/prequal/review";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// A short-lived link to the file in the private bucket.
export async function GET(request: Request, { params }: Ctx) {
  try {
    await requirePrequal(request);
    const url = await documentUrl((await params).id);
    if (!url) return NextResponse.json({ error: "No file has been uploaded for this yet." }, { status: 404 });
    return NextResponse.json({ url });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    // Marking something verified is the compliance decision; editing an
    // expiry date someone mistyped is not.
    const ctx = body?.status === "verified"
      ? await requirePrequalDecide(request)
      : await requirePrequal(request);
    return NextResponse.json(await updateDocument((await params).id, body, ctx.actor.id));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
