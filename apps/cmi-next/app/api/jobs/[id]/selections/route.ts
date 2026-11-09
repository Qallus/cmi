import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobSelections, createJobSelection } from "@/lib/job-selections/data";
import { selectionPatchFromInput } from "@/lib/selections/normalize";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "designer"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadJobSelections(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    // The full selection form (same as the Selections page), typed for the row.
    const patch = selectionPatchFromInput(await request.json());
    if (typeof patch.name !== "string") return NextResponse.json({ error: "Selection name is required." }, { status: 400 });
    return NextResponse.json(await createJobSelection(id, { ...patch, name: patch.name }), { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
