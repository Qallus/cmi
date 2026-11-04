import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET: a task's change history, newest first: who changed what (before → after)
// from the editor, the grid or an Excel import, and every move the schedule
// engine made to it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("schedule_activity").select("id, action, actor_id, actor_name, detail, created_at")
      .eq("item_id", id).order("created_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: people } = await sb.from("staff_users").select("id, display_name, email").in("id", ids);
      for (const p of people ?? []) names.set(p.id, p.display_name || p.email || "Staff");
    }
    return NextResponse.json({
      history: (data ?? []).map((r) => ({
        id: r.id, at: r.created_at, action: r.action,
        who: r.action === "engine_moved" ? "Schedule" : r.actor_name || (r.actor_id ? names.get(r.actor_id) : null) || "Someone",
        via: (r.detail as Record<string, unknown>)?.via ?? null,
        changes: ((r.detail as Record<string, unknown>)?.changes ?? {}) as Record<string, [unknown, unknown]>,
      })),
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
