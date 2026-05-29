import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decorateScheduleItems } from "@/lib/project-manager/data";
import type { ProjectScheduleItem } from "@/lib/project-manager/types";

const statuses = new Set(["pending", "scheduled", "in_progress", "waiting", "delayed", "blocked", "needs_approval", "complete", "canceled"]);
const priorities = new Set(["low", "normal", "high", "urgent", "critical", "blocking_closeout"]);
const types = new Set(["project", "phase", "task", "milestone"]);

function normalizeItem(body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const start = String(body.start_date || body.start || "").trim();
  const end = String(body.end_date || body.end || start).trim();
  if (!title) throw new Error("Schedule item title is required.");
  if (!start || !end) throw new Error("Start and end dates are required.");

  const status = statuses.has(String(body.status)) ? String(body.status) : "scheduled";
  const priority = priorities.has(String(body.priority)) ? String(body.priority) : "normal";
  const type = types.has(String(body.type)) ? String(body.type) : "task";

  return {
    board_id: body.board_id ? String(body.board_id) : "default",
    type,
    project_title: body.project_title ? String(body.project_title) : null,
    title,
    phase: body.phase ? String(body.phase) : null,
    assignee: body.assignee ? String(body.assignee) : null,
    client: body.client ? String(body.client) : null,
    participants: body.participants ? String(body.participants) : null,
    dependencies: body.dependencies ? String(body.dependencies) : null,
    start_date: start,
    end_date: end,
    status,
    priority,
    progress: Math.max(0, Math.min(100, Number(body.progress) || 0)),
    notify: Boolean(body.notify),
    description: body.description ? String(body.description) : null,
    forms: body.forms ? String(body.forms) : null,
    punch: body.punch ? String(body.punch) : null,
    client_visible: Boolean(body.client_visible),
    internal_notes: body.internal_notes ? String(body.internal_notes) : null,
    is_blocked: Boolean(body.is_blocked),
    blocker_reason: body.blocker_reason ? String(body.blocker_reason) : null,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    visible_on_gantt: body.visible_on_gantt !== false,
    schedule_group_key: body.schedule_group_key ? String(body.schedule_group_key) : body.project_title ? String(body.project_title) : null,
    template_slug: body.template_slug ? String(body.template_slug) : null,
    template_name: body.template_name ? String(body.template_name) : null,
    duration_minutes: Number.isFinite(Number(body.duration_minutes)) ? Number(body.duration_minutes) : null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const boardId = request.nextUrl.searchParams.get("board_id") || "default";
    const { data, error } = await supabase
      .from("project_schedule_items")
      .select("*")
      .eq("board_id", boardId)
      .order("start_date", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const items = await decorateScheduleItems(supabase, (data || []) as ProjectScheduleItem[]);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Schedule items load failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = normalizeItem(await request.json());
    const { data, error } = await supabase.from("project_schedule_items").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Schedule item create failed" }, { status: 500 });
  }
}
