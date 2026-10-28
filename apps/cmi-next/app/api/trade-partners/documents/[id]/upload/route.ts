// Office upload: a document a sub emailed in goes through the same tracking.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { storeDocumentFile } from "@/lib/prequal/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requirePrequal(request);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    const doc = await storeDocumentFile((await params).id, file, { folder: "office-uploads", uploadedBy: actor.id });
    return NextResponse.json({ ok: true, document: doc });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
