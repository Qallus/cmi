// Quick actions from the job Summary cards: take an open item ("assign to
// me") or check it off, whichever of the job's three task sources it lives in.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateItem as updateScheduleItem } from "@/lib/schedules/data";
import { updateItem as updatePunchItem } from "@/lib/punch/data";
import type { Assignee } from "@/lib/schedules/types";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "designer", "superintendent"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id: jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action === "complete" ? "complete" : body?.action === "assign_me" ? "assign_me" : null;
    const source = String(body?.source ?? "");
    const itemId = String(body?.id ?? "");
    if (!action || !itemId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

    const sb = getSupabaseAdmin();
    const name = staff.display_name || user.email || "Staff";
    const actor = { id: staff.id, name };

    if (source === "schedule") {
      const { data: item } = await sb.from("schedule_items").select("id, job_id, assignees").eq("id", itemId).maybeSingle();
      if (!item || item.job_id !== jobId) return NextResponse.json({ error: "Item not found on this job." }, { status: 404 });
      if (action === "complete") {
        await updateScheduleItem(itemId, { status: "complete", percent_complete: 100 }, actor);
      } else {
        const current = ((item.assignees ?? []) as Assignee[]).filter(Boolean);
        if (!current.some((a) => a.id === staff.id)) {
          await updateScheduleItem(itemId, { assignees: [...current, { id: staff.id, name, type: "staff" }] }, actor);
        }
      }
    } else if (source === "task") {
      const patch = action === "complete" ? { status: "complete", progress: 100 } : { assignee: name };
      const { data, error } = await sb.from("project_schedule_items").update(patch).eq("id", itemId).eq("board_id", jobId).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Item not found on this job." }, { status: 404 });
    } else if (source === "punch") {
      const { data: item } = await sb.from("punch_items").select("id, list:punch_lists!inner(job_id)").eq("id", itemId).maybeSingle();
      const listJob = (item as unknown as { list?: { job_id: string | null } } | null)?.list?.job_id;
      if (!item || listJob !== jobId) return NextResponse.json({ error: "Item not found on this job." }, { status: 404 });
      await updatePunchItem(itemId, action === "complete" ? { done: true } : { assigned_to: staff.id }, actor);
    } else {
      return NextResponse.json({ error: "Unknown item type." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't update the item." }, { status: 500 });
  }
}
