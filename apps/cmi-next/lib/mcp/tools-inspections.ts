// CMI MCP tools for inspections: the jurisdiction list (how each takes requests
// and its next-day cutoff), who may update inspection status, and a job's
// inspection profile (jurisdiction, scope, conditions). The same rules as the
// dashboard (Settings → Scheduling → Inspections, and Job Info): Super Admins and
// Admins edit jurisdictions, only Super Admins change who updates status.
// Thin wrappers over lib/inspections.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  loadJurisdictions, saveJurisdiction, loadInspectionSettings, saveInspectionSettings, inspectionsEnabled,
  InspectionSettingsError, type JurisdictionChanges, type InspectionJurisdiction,
} from "@/lib/inspections/data";
import {
  formatCutoff, canEditJurisdictions, canEditInspectionSettings, cleanStatusRoles, ALWAYS_STATUS_ROLES, STATUS_ROLE_OPTIONS,
} from "@/lib/inspections/settings";
import { CONDITION_GROUPS, CONDITION_KEYS, INSPECTION_SCOPES, cleanConditions } from "@/lib/inspections/conditions";
import { updateJob } from "@/lib/jobs/data";
import { WRITE_ROLES } from "@/lib/records-io/fields";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { resolveJobId } from "./tools-crm";
import type { McpCaller } from "./auth";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const role = (c: McpCaller) => c.ctx.role;

const brief = (j: InspectionJurisdiction) => ({
  code: j.code, name: j.name, active: j.active !== false,
  cutoff: j.cutoff_minutes == null ? "not published (to confirm)" : formatCutoff(j.cutoff_minutes),
  cutoff_minutes: j.cutoff_minutes, cutoff_label: j.cutoff_label, how_to_request: j.scheduling_method,
  phone: j.phone, portal_url: j.portal_url, inspection_hours: j.inspection_hours, notes: j.notes, verified_on: j.verified_on,
});

/** Finds a jurisdiction by code ("PHX") or name ("Phoenix", "City of Phoenix"). */
async function findJurisdiction(ref: unknown): Promise<InspectionJurisdiction | null> {
  const r = s(ref).toLowerCase();
  if (!r) return null;
  const all = await loadJurisdictions({ includeInactive: true });
  return all.find((j) => j.code.toLowerCase() === r)
    ?? all.find((j) => j.name.toLowerCase() === r)
    ?? (all.filter((j) => j.name.toLowerCase().includes(r)).length === 1 ? all.find((j) => j.name.toLowerCase().includes(r))! : null);
}

const errorOut = (e: unknown) => ({ result: { error: e instanceof Error ? e.message : String(e) } });

const CHANGE_FIELDS = "name, cutoff_time (e.g. \"3:30 PM\", \"15:30\", \"midnight\", or \"\" for not published), cutoff_label, scheduling_method (how to request), portal_url, phone, inspection_hours, notes, verified_on (YYYY-MM-DD), active (false retires it; jobs that use it keep it)";

export function inspectionTools(): McpTool[] {
  return [
    {
      name: "cmi_inspection_jurisdictions",
      title: "Inspection jurisdictions",
      description: "The building jurisdictions jobs pick from for inspections (Scottsdale, Phoenix, Paradise Valley, Mesa, Tempe, Chandler, Cave Creek, Carefree, Maricopa County and any added since): how each takes inspection requests, phone / portal, inspection hours, and the next-day cutoff (request by this time the business day before). Cutoffs still to confirm show as 'not published'.",
      risk: "read",
      available: (c) => canViewSchedules(role(c)),
      inputSchema: () => obj({ include_retired: { type: "boolean", description: "Include retired jurisdictions" } }),
      run: async (a) => {
        const list = await loadJurisdictions({ includeInactive: a.include_retired === true });
        return { result: {
          feature_on: await inspectionsEnabled(),
          count: list.length,
          to_confirm: list.filter((j) => j.cutoff_minutes == null && j.active !== false).map((j) => j.name),
          jurisdictions: list.map(brief),
        } };
      },
    },
    {
      name: "cmi_inspection_jurisdiction_save",
      title: "Add or edit an inspection jurisdiction",
      description: `Change a jurisdiction (by code like CHD or its name), e.g. set Chandler's confirmed cutoff to 4:00 PM. Fields: ${CHANGE_FIELDS}. A cutoff time without a cutoff_label fills the label in. Add a new one with create: true, a code (2–6 capital letters, e.g. GIL) and a name. Super Admins and Admins only. Confirm the change with the person in one line first, and set verified_on to today when they confirmed it with the jurisdiction.`,
      risk: "write",
      available: (c) => canEditJurisdictions(role(c)),
      inputSchema: () => obj({
        jurisdiction: str("Code (CHD) or name (Chandler). For a new one, the new code."),
        create: { type: "boolean", description: "Add a new jurisdiction (needs changes.name)" },
        changes: { type: "object", description: `Fields to set: ${CHANGE_FIELDS}`, additionalProperties: true },
      }, ["jurisdiction", "changes"]),
      run: async (a, c) => {
        try {
          const changes = (a.changes && typeof a.changes === "object" ? a.changes : {}) as JurisdictionChanges;
          if (a.create === true) {
            const created = await saveJurisdiction(s(a.jurisdiction), changes, c.ctx.id, { create: true });
            return { result: { created: brief(created) }, entity: "inspection_jurisdiction", recordId: created.code, after: created };
          }
          const before = await findJurisdiction(a.jurisdiction);
          if (!before) return { result: { error: `No jurisdiction matches "${s(a.jurisdiction)}". Call cmi_inspection_jurisdictions for the list, or pass create: true to add it.` } };
          const after = await saveJurisdiction(before.code, changes, c.ctx.id);
          return { result: { updated: brief(after) }, entity: "inspection_jurisdiction", recordId: after.code, before, after };
        } catch (e) { return errorOut(e); }
      },
    },
    {
      name: "cmi_inspection_settings",
      title: "Who can update inspection status",
      description: "Which staff roles may update an inspection's status (Passed, Failed / Correction, Re-inspect…). Super Admin and Admin always can; the rest is set by a Super Admin.",
      risk: "read",
      available: (c) => canViewSchedules(role(c)),
      inputSchema: () => obj(),
      run: async () => {
        const st = await loadInspectionSettings();
        return { result: { always: ALWAYS_STATUS_ROLES, allowed_roles: st.status_editor_roles, options: STATUS_ROLE_OPTIONS, updated_at: st.updated_at } };
      },
    },
    {
      name: "cmi_inspection_settings_update",
      title: "Change who can update inspection status",
      description: `Set which roles (besides Super Admin and Admin, who always can) may update inspection status. Roles: ${STATUS_ROLE_OPTIONS.map((o) => `${o.value} (${o.label})`).join(", ")}. Give the full list in roles, or use add / remove. Super Admins only; confirm with the person first.`,
      risk: "write",
      available: (c) => canEditInspectionSettings(role(c)),
      inputSchema: () => obj({
        roles: { type: "array", items: { type: "string" }, description: "The full list to allow (replaces it)" },
        add: { type: "array", items: { type: "string" }, description: "Roles to add" },
        remove: { type: "array", items: { type: "string" }, description: "Roles to remove" },
      }),
      run: async (a, c) => {
        try {
          const before = await loadInspectionSettings();
          let next = Array.isArray(a.roles) ? cleanStatusRoles(a.roles) : before.status_editor_roles;
          if (Array.isArray(a.add)) next = cleanStatusRoles([...next, ...a.add]);
          if (Array.isArray(a.remove)) { const drop = new Set(a.remove.map(String)); next = next.filter((r) => !drop.has(r)); }
          const after = await saveInspectionSettings(next, c.ctx.id);
          return { result: { always: ALWAYS_STATUS_ROLES, allowed_roles: after.status_editor_roles }, entity: "inspection_settings", recordId: "1", before, after };
        } catch (e) { return errorOut(e); }
      },
    },
    {
      name: "cmi_job_inspection_profile",
      title: "A job's inspection profile",
      description: `Read or set which inspections apply to a job: its jurisdiction (by parcel, not mailing address), scope (${INSPECTION_SCOPES.map((x) => `${x.value} = ${x.label}`).join("; ")}) and conditions that switch on "If …" inspections (${CONDITION_GROUPS.map((g) => `${g.label}: ${g.items.map((i) => i.key).join(", ")}`).join(" · ")}). With no changes it just reads. conditions replaces the list; add_conditions / remove_conditions adjust it.`,
      risk: "write",
      available: (c) => (WRITE_ROLES.jobs ?? []).includes(role(c) ?? ""),
      inputSchema: () => obj({
        job: str("Job id, number or name"),
        jurisdiction: str("Code (PHX) or name (Phoenix); empty string clears it"),
        scope: { type: "string", enum: ["NEW", "ADD", "REN", ""], description: "NEW, ADD or REN; empty clears it" },
        conditions: { type: "array", items: { type: "string", enum: CONDITION_KEYS }, description: "Replace the conditions" },
        add_conditions: { type: "array", items: { type: "string", enum: CONDITION_KEYS } },
        remove_conditions: { type: "array", items: { type: "string", enum: CONDITION_KEYS } },
      }, ["job"]),
      run: async (a, c) => {
        try {
          const job = await resolveJobId(a.job);
          const { data: before, error } = await getSupabaseAdmin().from("jobs").select("id, jurisdiction_code, inspection_scope, inspection_conditions").eq("id", job.id).single();
          if (error) throw new InspectionSettingsError(/column/i.test(error.message) ? "The inspection fields aren't in the database yet (migration 2026-11-11_inspection_milestones)." : error.message, 500);
          const patch: Json = {};
          if (typeof a.jurisdiction === "string") {
            if (!s(a.jurisdiction)) patch.jurisdiction_code = null;
            else {
              const j = await findJurisdiction(a.jurisdiction);
              if (!j) return { result: { error: `No jurisdiction matches "${s(a.jurisdiction)}". Call cmi_inspection_jurisdictions for the list.` } };
              if (j.active === false && j.code !== before.jurisdiction_code) return { result: { error: `${j.name} is retired; reactivate it first (cmi_inspection_jurisdiction_save active: true).` } };
              patch.jurisdiction_code = j.code;
            }
          }
          if (typeof a.scope === "string") patch.inspection_scope = s(a.scope).toUpperCase() || null;
          let conds = cleanConditions(before.inspection_conditions);
          let condsTouched = false;
          if (Array.isArray(a.conditions)) { conds = cleanConditions(a.conditions); condsTouched = true; }
          if (Array.isArray(a.add_conditions)) { conds = cleanConditions([...conds, ...a.add_conditions]); condsTouched = true; }
          if (Array.isArray(a.remove_conditions)) { const drop = new Set(a.remove_conditions.map(String)); conds = conds.filter((k) => !drop.has(k)); condsTouched = true; }
          if (condsTouched) patch.inspection_conditions = conds;
          const profile = (r: { jurisdiction_code?: string | null; inspection_scope?: string | null; inspection_conditions?: string[] | null }) =>
            ({ jurisdiction: r.jurisdiction_code ?? null, scope: r.inspection_scope ?? null, conditions: r.inspection_conditions ?? [] });
          if (!Object.keys(patch).length) return { result: { job: job.label, ...profile(before) } };
          const after = await updateJob(job.id, patch, { id: c.ctx.id, name: c.ctx.displayName ?? "Claude" });
          return { result: { job: job.label, ...profile(after) }, entity: "job", recordId: job.id, before: profile(before), after: profile(after) };
        } catch (e) { return errorOut(e); }
      },
    },
  ];
}
