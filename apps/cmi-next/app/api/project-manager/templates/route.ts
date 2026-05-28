import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [templates, tasks] = await Promise.all([
      supabase
        .from("project_templates")
        .select("id,name,slug,description,category,suggested_duration_days,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("project_template_tasks")
        .select("*")
        .order("sort_order", { ascending: true })
    ]);

    if (templates.error) throw templates.error;
    if (tasks.error) throw tasks.error;

    return NextResponse.json({
      templates: templates.data || [],
      tasks: tasks.data || []
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Templates load failed" }, { status: 500 });
  }
}
