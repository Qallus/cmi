// What's New entries (admins). GET all; POST create { title, body, href?,
// icon?, tag?, publish? }; PATCH { id, ...fields, published? }; DELETE ?id=.
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { requireDashboard, dashboardError } from "@/lib/dashboard/guard";
import { canManageWhatsNew } from "@/lib/dashboard/access";
import { createNews, deleteNews, listNews, updateNews } from "@/lib/dashboard/whats-new";

export const dynamic = "force-dynamic";

async function guard(req: Request) {
  const ctx = await requireDashboard(req);
  if (!canManageWhatsNew(ctx.role)) throw new AuthError("Only admins can manage What's New.", 403);
  return ctx;
}

const bad = (err: unknown) => (err instanceof AuthError ? dashboardError(err) : NextResponse.json({ error: (err as Error).message }, { status: 400 }));

export async function GET(req: Request) {
  try { await guard(req); return NextResponse.json({ entries: await listNews() }); } catch (err) { return bad(err); }
}

export async function POST(req: Request) {
  try {
    const { staffId } = await guard(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ entry: await createNews(body, staffId, body.publish === true) }, { status: 201 });
  } catch (err) { return bad(err); }
}

export async function PATCH(req: Request) {
  try {
    await guard(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.id !== "string") return NextResponse.json({ error: "Which entry?" }, { status: 400 });
    const { id, ...rest } = body;
    return NextResponse.json({ entry: await updateNews(id as string, rest) });
  } catch (err) { return bad(err); }
}

export async function DELETE(req: Request) {
  try {
    await guard(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });
    await deleteNews(id);
    return NextResponse.json({ ok: true });
  } catch (err) { return bad(err); }
}
