import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ENGINE_FLAG } from "@/lib/schedules/engine";
import { exportScheduleXlsx, templateXlsx, previewImport } from "@/lib/schedules/excel";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// GET ?kind=export (default) | template: download the schedule, or a blank sheet.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { id } = await params;
    const kind = new URL(request.url).searchParams.get("kind") === "template" ? "template" : "export";
    const { buffer, fileName } = kind === "template" ? await templateXlsx(id) : await exportScheduleXlsx(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST (multipart "file"): read an uploaded sheet and return the preview — what
// would change, what's new, what's missing (offered for deletion). Nothing is
// saved here; the grid applies the plan through /api/schedules/[id]/grid.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { id } = await params;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an .xlsx file." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 5 MB." }, { status: 400 });
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Upload an Excel .xlsx file (Save As → Excel Workbook)." }, { status: 400 });
    const plan = await previewImport(id, await file.arrayBuffer());
    return NextResponse.json({ ...plan, fileName: file.name });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message ?? "Couldn't read that file." }, { status: e.status ?? 500 }); }
}
