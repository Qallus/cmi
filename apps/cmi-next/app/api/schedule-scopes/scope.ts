// Shared by the schedule-scope routes: read and check /[type]/[id].
import { isFeatureEnabled } from "@/lib/flags";
import type { ScheduleScope, ScheduleScopeType } from "@/lib/schedules/types";

const TYPES: ScheduleScopeType[] = ["job", "deal", "precon", "selection"];

/** The scope from the URL, or an error message. Anything other than a job needs the schedule_builder flag. */
export async function readScope(params: Promise<{ type: string; id: string }>): Promise<{ scope: ScheduleScope } | { error: string; status: number }> {
  const { type, id } = await params;
  if (!TYPES.includes(type as ScheduleScopeType)) return { error: "Unknown schedule owner.", status: 400 };
  if (type !== "job" && !(await isFeatureEnabled("schedule_builder"))) return { error: "Schedules for deals, Pre-Con and selections aren't switched on yet.", status: 403 };
  return { scope: { type: type as ScheduleScopeType, id } };
}
