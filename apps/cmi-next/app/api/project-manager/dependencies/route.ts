import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const dependencyTypes = new Set(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]);

function normalizeDependency(body: Record<string, unknown>) {
  const source = String(body.source_item_id || "");
  const target = String(body.target_item_id || "");
  if (!source || !target) throw new Error("Source and target schedule item ids are required.");
  if (source === target) throw new Error("A schedule item cannot depend on itself.");
  const dependencyType = dependencyTypes.has(String(body.dependency_type)) ? String(body.dependency_type) : "finish_to_start";

  return {
    board_id: body.board_id ? String(body.board_id) : "default",
    source_item_id: source,
    target_item_id: target,
    dependency_type: dependencyType,
    lag_days: Number.isFinite(Number(body.lag_days)) ? Number(body.lag_days) : 0,
    auto_shift: Boolean(body.auto_shift),
    notes: body.notes ? String(body.notes) : null
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const boardId = request.nextUrl.searchParams.get("board_id") || "default";
    const { data, error } = await supabase
      .from("project_schedule_dependencies")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ dependencies: data || [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Dependencies load failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = normalizeDependency(await request.json());
    const { data, error } = await supabase.from("project_schedule_dependencies").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ dependency: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Dependency create failed" }, { status: 500 });
  }
}
