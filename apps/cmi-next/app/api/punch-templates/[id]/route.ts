// Delete a saved punch list template (built-ins can't be deleted).
import { NextResponse } from "next/server";
import { deleteTemplate } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await punchSession(request, true);
    await deleteTemplate((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return punchError(err);
  }
}
