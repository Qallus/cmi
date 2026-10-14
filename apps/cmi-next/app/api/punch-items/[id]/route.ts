// One punch item: check off ({ done }), edit fields, or delete.
import { NextResponse } from "next/server";
import { deleteItem, updateItem } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { actor } = await punchSession(request, true);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateItem((await params).id, body, actor));
  } catch (err) {
    return punchError(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await punchSession(request, true);
    await deleteItem((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return punchError(err);
  }
}
