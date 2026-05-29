import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ProjectManagerData, ProjectScheduleDependency, ProjectScheduleItem, ProjectTemplate, ProjectTemplateTask } from "./types";

type AssociationKey = "selections" | "media" | "codes" | "billing";

function emptyCounts() {
  return { selections: 0, media: 0, codes: 0, billing: 0, participants: 0 };
}

function participantCount(value: string | null | undefined) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean).length;
}

function addCount(counts: Map<string, ReturnType<typeof emptyCounts>>, id: unknown, key: AssociationKey) {
  if (!id || typeof id !== "string") return;
  const current = counts.get(id) || emptyCounts();
  current[key] += 1;
  counts.set(id, current);
}

export async function decorateScheduleItems(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  items: ProjectScheduleItem[]
): Promise<ProjectScheduleItem[]> {
  if (!items.length) return items;

  const counts = new Map<string, ReturnType<typeof emptyCounts>>();

  for (const item of items) {
    counts.set(item.id, { ...emptyCounts(), participants: participantCount(item.participants) });
  }

  const [selections, media, codes, billing] = await Promise.all([
    supabase.from("project_selections").select("project_schedule_item_id,related_task_id").limit(2000),
    supabase.from("project_media").select("project_schedule_item_id").limit(2000),
    supabase.from("project_code_references").select("project_schedule_item_id").limit(2000),
    supabase.from("project_billing_links").select("project_schedule_item_id").limit(2000)
  ]);

  if (!selections.error) {
    for (const row of selections.data || []) {
      addCount(counts, row.project_schedule_item_id, "selections");
      addCount(counts, row.related_task_id, "selections");
    }
  }

  if (!media.error) {
    for (const row of media.data || []) addCount(counts, row.project_schedule_item_id, "media");
  }

  if (!codes.error) {
    for (const row of codes.data || []) addCount(counts, row.project_schedule_item_id, "codes");
  }

  if (!billing.error) {
    for (const row of billing.data || []) addCount(counts, row.project_schedule_item_id, "billing");
  }

  return items.map(item => ({
    ...item,
    association_counts: counts.get(item.id) || { ...emptyCounts(), participants: participantCount(item.participants) }
  }));
}

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

  const scheduleItems = await decorateScheduleItems(supabase, (items.data || []) as ProjectScheduleItem[]);

  return {
    items: scheduleItems,
    dependencies: (dependencies.data || []) as ProjectScheduleDependency[],
    templates: (templates.data || []) as ProjectTemplate[],
    templateTasks: (templateTasks.data || []) as ProjectTemplateTask[]
  };
}
