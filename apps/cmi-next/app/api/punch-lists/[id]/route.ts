// One punch list: edit (title, description, client visibility, archive, move) and delete.
import { NextResponse } from "next/server";
import { deleteList, getList, updateList } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await punchSession(request, false);
    const list = await getList((await params).id);
    return list ? NextResponse.json(list) : NextResponse.json({ error: "Punch list not found." }, { status: 404 });
  } catch (err) {
    return punchError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await punchSession(request, true);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateList((await params).id, body));
  } catch (err) {
    return punchError(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await punchSession(request, true);
    await deleteList((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return punchError(err);
  }
}
