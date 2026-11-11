// Inspection library reads (docs/features/schedule-builder/inspection-milestones-plan.md).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";

export const INSPECTION_FLAG = "inspection_milestones";

export type InspectionJurisdiction = {
  code: string;
  name: string;
  sort_order: number;
  scheduling_method: string | null;
  portal_url: string | null;
  phone: string | null;
  /** Next-business-day cutoff, minutes after midnight the day before (1440 = midnight); null = not published. */
  cutoff_minutes: number | null;
  cutoff_label: string | null;
  inspection_hours: string | null;
  notes: string | null;
  verified_on: string | null;
};

export type InspectionLibraryRow = {
  milestone_id: string;
  jurisdiction_code: string;
  sort_order: number;
  phase_id: string;
  phase: string | null;
  doc_step: string | null;
  gantt_name: string;
  jurisdiction_name: string | null;
  code: string | null;
  code_basis: string | null;
  milestone_type: "inspection" | "internal" | "contract";
  scope_new: string | null;
  scope_add: string | null;
  scope_ren: string | null;
  include_when: string | null;
  predecessor_hook: string | null;
  released_hook: string | null;
  hold_point: boolean;
  request_rule: string | null;
  ready_checklist: string | null;
  repeats: string | null;
  show_on_master: string | null;
  notes: string | null;
  verified_on: string | null;
};

export async function inspectionsEnabled(): Promise<boolean> {
  return isFeatureEnabled(INSPECTION_FLAG).catch(() => false);
}

/** Jurisdictions in the library, in the workbook's order. Empty if the tables aren't there yet. */
export async function loadJurisdictions(): Promise<InspectionJurisdiction[]> {
  const { data, error } = await getSupabaseAdmin().from("inspection_jurisdictions").select("*").order("sort_order");
  if (error) return [];
  return (data ?? []) as InspectionJurisdiction[];
}

/** A jurisdiction's library rows, in the workbook's order (Step 3 filters them by scope and conditions). */
export async function loadLibrary(jurisdictionCode: string): Promise<InspectionLibraryRow[]> {
  const { data, error } = await getSupabaseAdmin().from("inspection_library").select("*")
    .eq("jurisdiction_code", jurisdictionCode).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as InspectionLibraryRow[];
}
