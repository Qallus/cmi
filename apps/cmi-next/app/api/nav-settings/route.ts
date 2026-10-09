// Hidden sidebar items. GET is read by every dashboard sidebar (like /api/flags,
// it returns only hrefs, nothing sensitive); PUT is Super Admin only.
import { NextResponse } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadHiddenNav, saveHiddenNav } from "@/lib/nav-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ hidden: await loadHiddenNav() });
}

export async function PUT(request: Request) {
  try {
    const { staff } = await requireSuperAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { hidden?: unknown };
    const hidden = Array.isArray(body.hidden) ? (body.hidden as string[]) : [];
    return NextResponse.json({ hidden: await saveHiddenNav(hidden, staff.id) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save." }, { status: 500 });
  }
}
