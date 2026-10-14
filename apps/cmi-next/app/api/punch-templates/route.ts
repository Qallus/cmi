// Punch list templates: built-in construction templates plus ones staff saved.
import { NextResponse } from "next/server";
import { listTemplates, saveTemplate } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await punchSession(request, false);
    return NextResponse.json(await listTemplates());
  } catch (err) {
    return punchError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { actor } = await punchSession(request, true);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveTemplate(body, actor), { status: 201 });
  } catch (err) {
    return punchError(err);
  }
}
