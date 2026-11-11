// Inspection library reads (docs/features/schedule-builder/inspection-milestones-plan.md).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import {
  parseCutoffTime, defaultCutoffLabel, isJurisdictionCode, cleanStatusRoles, canUpdateInspectionStatus, DEFAULT_STATUS_ROLES,
} from "./settings";

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
  /** Offered on jobs (2026-11-11_inspection_settings.sql); retired ones stay on jobs that use them. */
  active?: boolean;
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

/**
 * Jurisdictions, in list order. Active ones only unless asked; `keep` adds one
 * (e.g. the job's own, even if retired). Empty if the tables aren't there yet.
 */
export async function loadJurisdictions(opts: { includeInactive?: boolean; keep?: string | null } = {}): Promise<InspectionJurisdiction[]> {
  const { data, error } = await getSupabaseAdmin().from("inspection_jurisdictions").select("*").order("sort_order").order("name");
  if (error) return [];
  const rows = (data ?? []) as InspectionJurisdiction[];
  return opts.includeInactive ? rows : rows.filter((j) => j.active !== false || j.code === opts.keep);
}

export class InspectionSettingsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Fields of a jurisdiction people (and Claude) may set.
const JURISDICTION_TEXT = ["name", "scheduling_method", "portal_url", "phone", "cutoff_label", "inspection_hours", "notes"] as const;
export type JurisdictionChanges = Partial<Record<(typeof JURISDICTION_TEXT)[number], string | null>> & {
  /** "15:30", "3:30 PM", "midnight", or "" / null for not published. Wins over cutoff_minutes. */
  cutoff_time?: string | null;
  cutoff_minutes?: number | null;
  verified_on?: string | null;
  active?: boolean;
  sort_order?: number;
};

/**
 * Add or edit a jurisdiction. A new code needs a name; codes are the milestone
 * ID prefix (2–6 capital letters) and can't be renamed. Setting a cutoff time
 * without a label fills the label in ("3:30 PM the business day before").
 */
export async function saveJurisdiction(code: string, changes: JurisdictionChanges, actorId: string | null, opts: { create?: boolean } = {}): Promise<InspectionJurisdiction> {
  const key = code.trim().toUpperCase();
  if (!isJurisdictionCode(key)) throw new InspectionSettingsError("The code must be 2–6 capital letters, e.g. GIL for Gilbert.");
  const sb = getSupabaseAdmin();
  const { data: existing, error: readErr } = await sb.from("inspection_jurisdictions").select("*").eq("code", key).maybeSingle();
  if (readErr) throw new InspectionSettingsError(readErr.message, 500);
  if (!existing && !opts.create) throw new InspectionSettingsError(`No jurisdiction ${key}.`, 404);
  if (existing && opts.create) throw new InspectionSettingsError(`${key} already exists.`, 409);

  const patch: Record<string, unknown> = {};
  for (const k of JURISDICTION_TEXT) if (k in changes) patch[k] = typeof changes[k] === "string" ? changes[k]!.trim() || null : null;
  if ("name" in patch && !patch.name) throw new InspectionSettingsError("A jurisdiction needs a name.");
  if ("cutoff_time" in changes) {
    const m = parseCutoffTime(changes.cutoff_time);
    if (m === undefined) throw new InspectionSettingsError(`Couldn't read the cutoff time "${changes.cutoff_time}". Use e.g. 3:30 PM, 15:30 or midnight.`);
    patch.cutoff_minutes = m;
  } else if ("cutoff_minutes" in changes) {
    const m = changes.cutoff_minutes;
    if (m != null && (!Number.isInteger(m) || m < 0 || m > 1440)) throw new InspectionSettingsError("cutoff_minutes must be 0–1440.");
    patch.cutoff_minutes = m ?? null;
  }
  if ("cutoff_minutes" in patch && !("cutoff_label" in changes)) patch.cutoff_label = defaultCutoffLabel(patch.cutoff_minutes as number | null);
  if ("verified_on" in changes) {
    const v = (changes.verified_on ?? "").trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new InspectionSettingsError("verified_on must be YYYY-MM-DD.");
    patch.verified_on = v || null;
  }
  if ("active" in changes) patch.active = changes.active !== false;
  if ("sort_order" in changes && Number.isInteger(changes.sort_order)) patch.sort_order = changes.sort_order;

  if (!existing) {
    if (!patch.name) throw new InspectionSettingsError("A new jurisdiction needs a name.");
    const { data: last } = await sb.from("inspection_jurisdictions").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await sb.from("inspection_jurisdictions")
      .insert({ code: key, sort_order: (last?.sort_order ?? 0) + 1, ...patch, updated_by: actorId }).select("*").single();
    if (error) throw new InspectionSettingsError(error.message, 500);
    return data as InspectionJurisdiction;
  }
  if (!Object.keys(patch).length) return existing as InspectionJurisdiction;
  const { data, error } = await sb.from("inspection_jurisdictions")
    .update({ ...patch, updated_by: actorId, updated_at: new Date().toISOString() }).eq("code", key).select("*").single();
  if (error) throw new InspectionSettingsError(error.message, 500);
  return data as InspectionJurisdiction;
}

export type InspectionSettings = { status_editor_roles: string[]; updated_at: string | null };

/** Company-wide inspection settings; defaults until the settings table exists. */
export async function loadInspectionSettings(): Promise<InspectionSettings> {
  const { data, error } = await getSupabaseAdmin().from("inspection_settings").select("status_editor_roles, updated_at").eq("id", 1).maybeSingle();
  if (error || !data) return { status_editor_roles: [...DEFAULT_STATUS_ROLES], updated_at: null };
  return { status_editor_roles: cleanStatusRoles(data.status_editor_roles), updated_at: data.updated_at ?? null };
}

/** Set which roles (besides Super Admin and Admin) may update inspection status. */
export async function saveInspectionSettings(roles: unknown, actorId: string | null): Promise<InspectionSettings> {
  const status_editor_roles = cleanStatusRoles(roles);
  const { data, error } = await getSupabaseAdmin().from("inspection_settings")
    .upsert({ id: 1, status_editor_roles, updated_by: actorId, updated_at: new Date().toISOString() }).select("status_editor_roles, updated_at").single();
  if (error) throw new InspectionSettingsError(error.message, 500);
  return { status_editor_roles: cleanStatusRoles(data.status_editor_roles), updated_at: data.updated_at ?? null };
}

/** May this staff role update an inspection's status? (Used by Step 4.) */
export async function mayUpdateInspectionStatus(role: string | null | undefined): Promise<boolean> {
  return canUpdateInspectionStatus(role, (await loadInspectionSettings()).status_editor_roles);
}

/** A jurisdiction's library rows, in the workbook's order (Step 3 filters them by scope and conditions). */
export async function loadLibrary(jurisdictionCode: string): Promise<InspectionLibraryRow[]> {
  const { data, error } = await getSupabaseAdmin().from("inspection_library").select("*")
    .eq("jurisdiction_code", jurisdictionCode).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as InspectionLibraryRow[];
}
