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
import { inspectionInfo, setInspectionStatus } from "@/lib/inspections/status-data";
import { INSPECTION_STATUSES, inspectionStatusLabel, requestBy, CLEARS_HOLD, TO_REQUEST } from "@/lib/inspections/status";
import { todayAZ } from "@/lib/schedules/progress";
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
    {
      name: "cmi_job_inspections",
      title: "A job's inspection milestones",
      description: "The inspection milestones on a job's schedules (loaded from its jurisdiction's library): step ID, date, status (Not Ready, Ready to Call, Requested, Scheduled, Passed, Partial, Failed / Correction, Re-inspect Requested, N/A), hold point, and when to request it (the jurisdiction's cutoff on the working day before). Also says which ones need a call today. Use item_id from here with cmi_inspection_status_update.",
      risk: "read",
      available: (c) => canViewSchedules(role(c)),
      inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
      run: async (a) => {
        try {
          if (!(await inspectionsEnabled())) return { result: { error: "Inspection milestones are turned off." } };
          const jobId = await resolveJobId(a.job);
          if (!jobId) return { result: { error: "No job matches that." } };
          const sb = getSupabaseAdmin();
          const [{ data: job }, { data: items, error }] = await Promise.all([
            sb.from("jobs").select("id, job_number, job_name, jurisdiction_code, inspection_scope").eq("id", jobId).maybeSingle(),
            sb.from("schedule_items").select("id, schedule_id, title, start_date, status, inspection_step_id, inspection_status, inspection_code").eq("job_id", jobId).not("inspection_step_id", "is", null).order("start_date"),
          ]);
          if (error) return { result: { error: error.message } };
          const jur = job?.jurisdiction_code ? (await loadJurisdictions({ includeInactive: true })).find((j) => j.code === job.jurisdiction_code) ?? null : null;
          const { data: lib } = items?.length
            ? await sb.from("inspection_library").select("milestone_id, hold_point").in("milestone_id", Array.from(new Set(items.map((i) => i.inspection_step_id as string))))
            : { data: [] };
          const hold = new Map((lib ?? []).map((l) => [l.milestone_id, !!l.hold_point]));
          const today = todayAZ();
          const rows = (items ?? []).map((i) => {
            // Permit / contract (MS) and internal check (CHK) rows carry no inspection status.
            const st = i.inspection_status ?? null;
            const by = !st || CLEARS_HOLD.has(st) || i.status === "cancelled" ? null : requestBy(i.start_date, jur?.cutoff_minutes ?? null, jur?.scheduling_method ?? null);
            return {
              item_id: i.id, schedule_id: i.schedule_id, step_id: i.inspection_step_id, title: i.title, code: i.inspection_code, date: i.start_date,
              status: st ? inspectionStatusLabel(st) : "Milestone (not an inspection)", status_value: st, hold_point: hold.get(i.inspection_step_id as string) ?? false,
              request_by: by?.label ?? null, call_today: !!by && !!st && by.date <= today && TO_REQUEST.has(st),
            };
          });
          return { result: {
            job: job ? [job.job_number, job.job_name].filter(Boolean).join(" · ") : jobId,
            jurisdiction: jur ? { code: jur.code, name: jur.name, cutoff: jur.cutoff_minutes == null ? "not published (to confirm)" : formatCutoff(jur.cutoff_minutes) } : null,
            scope: job?.inspection_scope ?? null,
            count: rows.length, call_today: rows.filter((r) => r.call_today).length,
            statuses: INSPECTION_STATUSES.map((x) => ({ value: x.value, label: x.label })),
            inspections: rows,
          } };
        } catch (e) { return errorOut(e); }
      },
    },
    {
      name: "cmi_inspection_status_update",
      title: "Update an inspection's status",
      description: "Set an inspection milestone's status (item_id from cmi_job_inspections). status: not_ready, ready_to_call, requested, scheduled, passed, partial, failed, reinspect_requested, na. passed finishes it (date = the day it passed, default today) so the work it holds can start; failed needs the re-inspection date and a note on the corrections, and moves the milestone there so the forecast pushes what follows; a date on requested / scheduled / reinspect_requested / partial moves it too; na keeps it on record out of the way. Each change adds a dated line to the item's notes. Roles: Settings → Scheduling → Inspections (PMs and Superintendents by default). Confirm in one line first.",
      risk: "write",
      available: (c) => canViewSchedules(role(c)),
      inputSchema: () => obj({
        item_id: str("The inspection milestone's item_id"),
        status: { type: "string", enum: INSPECTION_STATUSES.map((x) => x.value) },
        date: str("YYYY-MM-DD: re-inspection date (failed), inspection date (requested / scheduled), or the day it passed"),
        note: str("Inspector, result, ticket number, or the corrections (required for failed)"),
      }, ["item_id", "status"]),
      run: async (a, c) => {
        try {
          if (!(await inspectionsEnabled())) return { result: { error: "Inspection milestones are turned off." } };
          await setInspectionStatus(s(a.item_id), { status: s(a.status), date: s(a.date) || null, note: s(a.note) || null },
            { id: c.ctx.id, name: c.ctx.displayName ?? "Claude", role: role(c) ?? null });
          const info = await inspectionInfo(s(a.item_id), role(c));
          return { result: { ok: true, step_id: info.step_id, status: info.status_label, date: info.date, request_by: info.request_by?.label ?? null } };
        } catch (e) { return errorOut(e); }
      },
    },
  ];
}
