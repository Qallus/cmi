import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { convertTradeLabel } from "@/lib/schedules/resources-data";

// POST { labelId: "trade:electrician", companyId, jobId? }: swap a trade label
// for a trade partner on every task that has it (one job, or every job).
export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const b = (await request.json().catch(() => ({}))) as { labelId?: string; companyId?: string; jobId?: string | null };
    if (!b.labelId?.startsWith("trade:") || !b.companyId) return NextResponse.json({ error: "Pick the trade and the trade partner." }, { status: 400 });
    const { data: co } = await getSupabaseAdmin().from("companies").select("id, name").eq("id", b.companyId).maybeSingle();
    if (!co) return NextResponse.json({ error: "That trade partner wasn't found." }, { status: 404 });
    const tasks = await convertTradeLabel(b.labelId, co, { jobId: b.jobId ?? null }, { id: staff.id, name: staff.display_name ?? null });
    return NextResponse.json({ tasks, partner: co.name });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
