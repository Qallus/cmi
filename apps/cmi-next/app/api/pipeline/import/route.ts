// Bulk-create Pre-Con opportunities from mapped CSV / Bolt-read rows.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { importRecords, type DuplicateAction } from "@/lib/records-io/server";

export const runtime = "nodejs";
const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const MAX_ROWS = 500;

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create opportunities.` }, { status: 403 });
    }
    const body = (await request.json()) as { rows?: Record<string, unknown>[]; duplicateAction?: DuplicateAction };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Import at most ${MAX_ROWS} rows at a time.` }, { status: 400 });
    const results = await importRecords("precon", rows, body.duplicateAction === "create" ? "create" : "skip", { name: user.email, id: staff.id });
    return NextResponse.json({ results });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
