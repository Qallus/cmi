// Punch lists: list (for one record, "mine", or all) and create.
//   GET ?parent_type=job&parent_id=… | ?scope=mine | ?scope=all [&archived=1]
//   POST { parent_type, parent_id, title, description?, client_visible?, template_id?, items? }
import { NextResponse } from "next/server";
import { createList, loadLists } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";
import { PARENT_COLUMN, type PunchParentType } from "@/lib/punch/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await punchSession(request, false);
    const sp = new URL(request.url).searchParams;
    const parentType = sp.get("parent_type") as PunchParentType | null;
    const parentId = sp.get("parent_id");
    const includeArchived = sp.get("archived") === "1";
    if (parentType && parentId) {
      if (!PARENT_COLUMN[parentType]) return NextResponse.json({ error: "Unknown record type." }, { status: 400 });
      return NextResponse.json(await loadLists({ parentType, parentId, includeArchived }));
    }
    if (sp.get("scope") === "mine") return NextResponse.json(await loadLists({ assignedTo: staff.id as string, includeArchived }));
    return NextResponse.json(await loadLists({ includeArchived }));
  } catch (err) {
    return punchError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { actor } = await punchSession(request, true);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await createList(body, actor), { status: 201 });
  } catch (err) {
    return punchError(err);
  }
}
