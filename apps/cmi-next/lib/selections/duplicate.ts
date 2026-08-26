import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ProjectSelection } from "./types";

// Server-side copy of a project_selections row (all columns, incl. images,
// gallery, metadata, size/finish/colors, features). Names the copy "… (Copy)",
// resets the client-approval state so the duplicate starts fresh, and applies
// any overrides (e.g. job_id, created_by). Returns the new row.
export async function duplicateSelection(
  sourceId: string,
  overrides: Record<string, unknown> = {},
): Promise<ProjectSelection> {
  const sb = getSupabaseAdmin();
  const { data: src, error } = await sb.from("project_selections").select("*").eq("id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!src) throw new Error("Selection not found.");

  const now = new Date().toISOString();
  const copy: Record<string, unknown> = { ...src, ...overrides };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  copy.name = `${(src.name as string) ?? "Selection"} (Copy)`;
  // Start the copy fresh — never inherit an approval/decision from the original.
  copy.approval_status = "not_required";
  copy.client_approval_status = "not_sent";
  copy.client_approved_at = null;
  copy.client_rejected_at = null;
  copy.client_comments = null;
  copy.updated_at = now;

  const { data, error: insErr } = await sb.from("project_selections").insert(copy).select("*").single();
  if (insErr) throw new Error(insErr.message);
  return data as ProjectSelection;
}
