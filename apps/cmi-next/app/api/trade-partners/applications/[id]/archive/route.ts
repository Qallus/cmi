// Archive an application (POST) or put it back in the queue (DELETE).
//
// Archiving loses nothing — it takes a row out of the working list, which is
// what you want for a test submission or a partner who went quiet.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { setApplicationArchived } from "@/lib/prequal/review";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const ctx = await requirePrequal(request);
    return NextResponse.json(await setApplicationArchived((await params).id, true, ctx.actor.id));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const ctx = await requirePrequal(request);
    return NextResponse.json(await setApplicationArchived((await params).id, false, ctx.actor.id));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
