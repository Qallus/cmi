import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ProjectManagerData, ProjectScheduleDependency, ProjectScheduleItem, ProjectTemplate, ProjectTemplateTask } from "./types";

export async function loadProjectManagerData(boardId = "default"): Promise<ProjectManagerData> {
  const supabase = getSupabaseAdmin();

  const [items, dependencies, templates, templateTasks] = await Promise.all([
    supabase
      .from("project_schedule_items")
      .select("*")
      .eq("board_id", boardId)
      .order("start_date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_schedule_dependencies")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true }),
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

  for (const result of [items, dependencies, templates, templateTasks]) {
    if (result.error) throw result.error;
  }

  return {
    items: (items.data || []) as ProjectScheduleItem[],
    dependencies: (dependencies.data || []) as ProjectScheduleDependency[],
    templates: (templates.data || []) as ProjectTemplate[],
    templateTasks: (templateTasks.data || []) as ProjectTemplateTask[]
  };
}
