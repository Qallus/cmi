import { NextRequest, NextResponse } from "next/server";
import { addDays, dateOnly } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ProjectTemplateTask } from "@/lib/project-manager/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const templateId = String(body.template_id || "");
    const projectTitle = String(body.project_title || "").trim();
    const boardId = String(body.board_id || "default");
    const startDate = dateOnly(String(body.start_date || new Date().toISOString().slice(0, 10)));
    if (!templateId) throw new Error("Template id is required.");
    if (!projectTitle) throw new Error("Project title is required.");

    const supabase = getSupabaseAdmin();
    const [templateResult, taskResult] = await Promise.all([
      supabase.from("project_templates").select("*").eq("id", templateId).single(),
      supabase.from("project_template_tasks").select("*").eq("template_id", templateId).order("sort_order", { ascending: true })
    ]);
    if (templateResult.error) throw templateResult.error;
    if (taskResult.error) throw taskResult.error;

    const template = templateResult.data;
    const tasks = (taskResult.data || []) as ProjectTemplateTask[];
    const rows = tasks.map((task, index) => {
      const start = addDays(startDate, task.offset_days || 0);
      const durationDays = Math.max(1, Math.ceil((task.duration_minutes || 1440) / 1440));
      return {
        board_id: boardId,
        type: task.task_key === "intake" ? "project" : "task",
        project_title: projectTitle,
        title: task.task_name,
        phase: task.phase_name,
        assignee: (task.suggested_roles || []).join(", "),
        dependencies: (task.dependency_keys || []).join(", "),
        start_date: start,
        end_date: addDays(start, durationDays - 1),
        status: "scheduled",
        priority: task.priority || "normal",
        progress: 0,
        notify: false,
        description: task.description,
        client_visible: task.client_visible,
        visible_on_gantt: true,
        schedule_group_key: projectTitle,
        template_slug: template.slug,
        template_name: template.name,
        duration_minutes: task.duration_minutes,
        sort_order: index + 1,
        metadata: {
          template_task_key: task.task_key,
          dependency_keys: task.dependency_keys || []
        }
      };
    });

    const { data: items, error: insertError } = await supabase.from("project_schedule_items").insert(rows).select();
    if (insertError) throw insertError;

    const byKey = new Map<string, string>();
    (items || []).forEach(item => {
      const key = item.metadata?.template_task_key;
      if (typeof key === "string") byKey.set(key, item.id);
    });

    const dependencies = tasks.flatMap(task => {
      const target = byKey.get(task.task_key);
      if (!target) return [];
      return (task.dependency_keys || [])
        .map(sourceKey => byKey.get(sourceKey))
        .filter((source): source is string => Boolean(source))
        .map(source => ({
          board_id: boardId,
          source_item_id: source,
          target_item_id: target,
          dependency_type: "finish_to_start",
          auto_shift: true,
          lag_days: 0
        }));
    });

    if (dependencies.length) {
      const { error } = await supabase.from("project_schedule_dependencies").insert(dependencies);
      if (error) throw error;
    }

    return NextResponse.json({ items: items || [], dependencies_created: dependencies.length });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Template apply failed" }, { status: 500 });
  }
}
