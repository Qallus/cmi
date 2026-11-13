// More schedule tools, covering the rest of the Schedules page: phases, deleting
// tasks and links, Renumber by 10s, bulk grid edits, baselines, the weekly
// update, the three-week lookahead, health, work calendars, scheduling mode,
// resources, participants, history, archive / delete, and adding inspections.
import {
  createPhase, updatePhase, deletePhase, deleteItem, deleteDependency, captureBaseline, listBaselines,
  archiveSchedule, deleteSchedule, listParticipants, addParticipant, removeParticipant, listActivity,
} from "@/lib/schedules/data";
import { applyGridOps, renumberPreview } from "@/lib/schedules/grid-data";
import { loadUpdate, pushTask, finishUpdate, draftNarrative, postNarrative } from "@/lib/schedules/weekly-update-data";
import { loadLookahead } from "@/lib/schedules/lookahead-data";
import { loadHealth, schedulesNeedingALook } from "@/lib/schedules/health-data";
import { getCalendar, inheritedFor, saveCalendar, type CalendarScope } from "@/lib/schedules/calendars-data";
import { switchMode } from "@/lib/schedules/engine";
import { resourcePool, assignTasks, loadResourceView } from "@/lib/schedules/resources-data";
import { candidatesForSchedule, applyInspections } from "@/lib/inspections/apply";
import { canEditSchedules, canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { GridOps } from "@/lib/schedules/grid";
import type { Assignee, SchedulingMode } from "@/lib/schedules/types";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });
const strList = (description: string) => ({ type: "array", items: { type: "string" }, description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : []);
const actorOf = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName || c.ctx.email });
const view = (c: McpCaller) => canViewSchedules(c.ctx.role);
const edit = (c: McpCaller) => canEditSchedules(c.ctx.role);
const manage = (c: McpCaller) => canManageSchedules(c.ctx.role);
const SID = { schedule_id: str("Schedule id (cmi_schedules_list)") };

async function schedName(id: string): Promise<string> {
  const { data } = await getSupabaseAdmin().from("job_schedules").select("name").eq("id", id).maybeSingle();
  if (!data) throw new Error("No schedule with that id.");
  return data.name as string;
}

const phaseTools: McpTool[] = [
  {
    name: "cmi_schedule_phase_save",
    title: "Add or change a schedule phase",
    description: "Add a phase (section) to a schedule (schedule_id + name), or change one (phase_id + name / color / sort_order / client_visible).",
    risk: "write",
    available: edit,
    inputSchema: () => obj({ ...SID, phase_id: str("Phase id (to change)"), name: str("Phase name"), color: str("#rrggbb"), sort_order: { type: "integer" }, client_visible: bool("Shown to the client") }),
    run: async (a, c) => {
      const patch: Json = {};
      for (const k of ["name", "color"]) if (s(a[k])) patch[k] = s(a[k]);
      if (typeof a.sort_order === "number") patch.sort_order = a.sort_order;
      if (typeof a.client_visible === "boolean") patch.client_visible = a.client_visible;
      if (s(a.phase_id)) { const p = await updatePhase(s(a.phase_id), patch); return { result: { phase: p }, entity: "schedule_phase", recordId: p.id, after: p }; }
      if (!s(a.schedule_id) || !s(a.name)) throw new Error("Give schedule_id and a name.");
      const p = await createPhase(s(a.schedule_id), patch, actorOf(c));
      return { result: { phase: p }, entity: "schedule_phase", recordId: p.id, after: p };
    },
  },
  {
    name: "cmi_schedule_phase_delete",
    title: "Delete a schedule phase",
    description: "Delete a phase; its tasks stay on the schedule without a phase. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: edit,
    inputSchema: () => obj({ phase_id: str("Phase id") }, ["phase_id"]),
    preview: async (a): Promise<Preview> => {
      const { data } = await getSupabaseAdmin().from("schedule_phases").select("id, name").eq("id", s(a.phase_id)).maybeSingle();
      if (!data) throw new Error("No phase with that id.");
      return { summary: `Delete the phase "${data.name}". Its tasks stay, without a phase.`, entity: "schedule_phase", recordId: s(a.phase_id) };
    },
    execute: async (a) => { await deletePhase(s(a.phase_id)); return { result: { deleted: true }, entity: "schedule_phase", recordId: s(a.phase_id), after: null }; },
  },
  {
    name: "cmi_schedule_item_delete",
    title: "Delete a schedule task",
    description: "Delete a task or milestone and its links. Tasks that only depended on it are left with no predecessor. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: edit,
    inputSchema: () => obj({ item_id: str("Task id") }, ["item_id"]),
    preview: async (a): Promise<Preview> => {
      const { data } = await getSupabaseAdmin().from("schedule_items").select("id, title, activity_id").eq("id", s(a.item_id)).maybeSingle();
      if (!data) throw new Error("No task with that id.");
      return { summary: `Delete ${data.activity_id ?? ""} "${data.title}" and its links.`.replace("  ", " "), entity: "schedule_item", recordId: s(a.item_id) };
    },
    execute: async (a, c) => { await deleteItem(s(a.item_id), actorOf(c)); return { result: { deleted: true }, entity: "schedule_item", recordId: s(a.item_id), after: null }; },
  },
  {
    name: "cmi_schedule_link_delete",
    title: "Delete a link between tasks",
    description: "Remove one predecessor link (dependency id from cmi_schedule_items). Previews first; runs with cmi_confirm.",
    risk: "high",
    available: edit,
    inputSchema: () => obj({ dependency_id: str("Dependency id") }, ["dependency_id"]),
    preview: async (a): Promise<Preview> => ({ summary: "Remove this link between two tasks; dates recalculate.", entity: "schedule_dependency", recordId: s(a.dependency_id) }),
    execute: async (a, c) => { await deleteDependency(s(a.dependency_id), actorOf(c)); return { result: { deleted: true }, entity: "schedule_dependency", recordId: s(a.dependency_id), after: null }; },
  },
];

const gridTools: McpTool[] = [
  {
    name: "cmi_schedule_renumber",
    title: "Renumber activity IDs by 10s",
    description: "Renumber a schedule's activity IDs 10, 20, 30… in schedule order; links follow and the old → new map is saved in the schedule history. dry_run (default true) only shows the old → new list. Notes or printouts that quote old IDs go out of date.",
    risk: "write",
    available: edit,
    inputSchema: () => obj({ ...SID, dry_run: bool("Only show what would change (default true)") }, ["schedule_id"]),
    run: async (a, c) => {
      const plan = await renumberPreview(s(a.schedule_id));
      const changes = plan.filter((p) => p.from !== p.to);
      if (a.dry_run !== false) return { result: { dry_run: true, would_change: changes.length, of: plan.length, changes: changes.slice(0, 300) } };
      const r = await applyGridOps(s(a.schedule_id), { renumber: true }, actorOf(c));
      return { result: { renumbered: (r.renumbered ?? []).filter((p) => p.from !== p.to).length }, entity: "job_schedule", recordId: s(a.schedule_id), after: r.renumbered };
    },
  },
  {
    name: "cmi_schedule_grid_apply",
    title: "Bulk edit a schedule (grid)",
    description: "Several schedule changes in one go, saved and recalculated together, exactly like the grid: updates [{id, patch}], creates [{tempId, row}], predecessors [{itemId, links:[{sourceItemId, type: finish_to_start|start_to_start|finish_to_finish|start_to_finish, lag}]}]. Deletes aren't taken here (use cmi_schedule_item_delete). Returns tasks it moved and any moves refused because their links don't allow them.",
    risk: "write",
    available: edit,
    inputSchema: () => obj({ ...SID, updates: { type: "array", items: { type: "object" } }, creates: { type: "array", items: { type: "object" } }, predecessors: { type: "array", items: { type: "object" } } }, ["schedule_id"]),
    run: async (a, c) => {
      const ops: GridOps = {};
      if (Array.isArray(a.updates)) ops.updates = a.updates as never;
      if (Array.isArray(a.creates)) ops.creates = a.creates as never;
      if (Array.isArray(a.predecessors)) ops.predecessors = a.predecessors as never;
      if (!ops.updates && !ops.creates && !ops.predecessors) throw new Error("Nothing to change.");
      const r = await applyGridOps(s(a.schedule_id), ops, actorOf(c));
      return { result: r as unknown as Json, entity: "job_schedule", recordId: s(a.schedule_id) };
    },
  },
];

const trackingTools: McpTool[] = [
  {
    name: "cmi_schedule_baselines",
    title: "Schedule baselines",
    description: "List a schedule's baselines, or capture a new one (capture: true, name, reason) to compare progress against later.",
    risk: "write",
    available: view,
    inputSchema: () => obj({ ...SID, capture: bool("Capture a new baseline"), name: str("Baseline name"), reason: str("Why") }, ["schedule_id"]),
    run: async (a, c) => {
      if (a.capture === true) {
        if (!manage(c)) throw new Error(`Your role (${c.ctx.role}) can't capture baselines.`);
        const b = await captureBaseline(s(a.schedule_id), s(a.name) || `Baseline ${new Date().toISOString().slice(0, 10)}`, s(a.reason) || null, actorOf(c));
        return { result: { captured: b }, entity: "schedule_baseline", recordId: (b as { id: string }).id, after: b };
      }
      return { result: { baselines: await listBaselines(s(a.schedule_id)) } };
    },
  },
  {
    name: "cmi_schedule_weekly_update",
    title: "Weekly schedule update",
    description: "The weekly update: action load (tasks due for a status this week), push (item_id, to YYYY-MM-DD, reason: move one task), finish (set the status date and recalculate; returns what moved and a drafted narrative), post (text: post the narrative to the job's daily log).",
    risk: "write",
    available: view,
    inputSchema: () => obj({ ...SID, action: { type: "string", enum: ["load", "push", "finish", "post"] }, item_id: str("Task id (push)"), to: str("New start YYYY-MM-DD (push)"), reason: str("Why it moved (push)"), text: str("Narrative to post") }, ["schedule_id", "action"]),
    run: async (a, c) => {
      const id = s(a.schedule_id);
      if (a.action === "load") return { result: (await loadUpdate(id)) as unknown as Json };
      if (!edit(c)) throw new Error(`Your role (${c.ctx.role}) can't update schedules.`);
      if (a.action === "push") { const r = await pushTask(id, s(a.item_id), s(a.to), s(a.reason) || "Weekly update", actorOf(c)); return { result: r as unknown as Json, entity: "schedule_item", recordId: s(a.item_id) }; }
      if (a.action === "finish") { const f = await finishUpdate(id, actorOf(c)); const n = await draftNarrative(id, f); return { result: { ...(f as unknown as Json), narrative_draft: n.text }, entity: "job_schedule", recordId: id }; }
      if (a.action === "post") { if (!s(a.text)) throw new Error("Give the narrative text."); const r = await postNarrative(id, s(a.text), actorOf(c)); return { result: r as unknown as Json, entity: "job_schedule", recordId: id }; }
      throw new Error("Unknown action.");
    },
  },
  {
    name: "cmi_schedule_lookahead",
    title: "Three-week lookahead",
    description: "What's coming up on a schedule in the next three weeks (the lookahead), with selections due and inspection call-by dates. audience client shows only what the client sees.",
    risk: "read",
    available: view,
    inputSchema: () => obj({ ...SID, audience: { type: "string", enum: ["internal", "client"] } }, ["schedule_id"]),
    run: async (a) => ({ result: (await loadLookahead(s(a.schedule_id), a.audience === "client" ? "client" : "internal")) as unknown as Json }),
  },
  {
    name: "cmi_schedule_health",
    title: "Schedule health",
    description: "A schedule's health tiles (vs baseline, vs contract, behind, float on finish, weather days, late selections, waiting on inspection), or with no schedule_id the schedules across all jobs that most need a look.",
    risk: "read",
    available: view,
    inputSchema: () => obj({ schedule_id: str("Schedule id (omit for the ones needing a look)") }),
    run: async (a) => ({ result: s(a.schedule_id) ? (await loadHealth(s(a.schedule_id))) as unknown as Json : { needing_a_look: await schedulesNeedingALook(10) } }),
  },
  {
    name: "cmi_schedule_activity",
    title: "Schedule history",
    description: "Recent changes on a schedule or across a job's schedules (who moved what, renumbers, imports).",
    risk: "read",
    available: view,
    inputSchema: () => obj({ schedule_id: str("Schedule id"), job_id: str("Job id"), limit: { type: "integer", minimum: 1, maximum: 200 } }),
    run: async (a) => ({ result: { activity: await listActivity({ scheduleId: s(a.schedule_id) || undefined, jobId: s(a.job_id) || undefined, limit: typeof a.limit === "number" ? a.limit : 50 }) } }),
  },
];

const setupTools: McpTool[] = [
  {
    name: "cmi_schedule_calendar",
    title: "Work calendar",
    description: "Read or save a work calendar: scope company (Settings → Scheduling), job or schedule (scope_id). Save with workdays {mon..sun: true/false} and/or exceptions [{date, working, type (holiday|weather|closure|workday), label}]. Lower levels inherit from higher ones.",
    risk: "write",
    available: view,
    inputSchema: () => obj({ scope: { type: "string", enum: ["company", "job", "schedule"] }, scope_id: str("Job or schedule id (not for company)"), save: bool("Save the calendar"), workdays: { type: "object" }, exceptions: { type: "array", items: { type: "object" } } }, ["scope"]),
    run: async (a, c) => {
      const scope = s(a.scope) as CalendarScope, id = scope === "company" ? null : s(a.scope_id) || null;
      if (a.save === true) {
        if (!manage(c)) throw new Error(`Your role (${c.ctx.role}) can't change work calendars.`);
        const r = await saveCalendar(scope, id, { workdays: a.workdays, exceptions: a.exceptions }, { id: c.ctx.id });
        return { result: r as unknown as Json, entity: "work_calendar", recordId: id ?? "company" };
      }
      const [own, inherited] = await Promise.all([getCalendar(scope, id), inheritedFor(scope)]);
      return { result: { calendar: own, inherited } };
    },
  },
  {
    name: "cmi_schedule_mode",
    title: "Scheduling mode",
    description: "Switch a schedule between legacy (dates as typed), auto (critical path: links set dates) and manual (links shown, dates kept). keep_dates holds today's dates as start-no-earlier-than. dry_run (default true) shows what would move.",
    risk: "write",
    available: manage,
    inputSchema: () => obj({ ...SID, mode: { type: "string", enum: ["legacy", "auto", "manual"] }, keep_dates: bool("Keep today's dates"), dry_run: bool("Only show the result (default true)") }, ["schedule_id", "mode"]),
    run: async (a, c) => {
      const r = await switchMode(s(a.schedule_id), s(a.mode) as SchedulingMode, a.keep_dates !== false, actorOf(c), { dryRun: a.dry_run !== false });
      return { result: r as unknown as Json, ...(a.dry_run === false ? { entity: "job_schedule", recordId: s(a.schedule_id) } : {}) };
    },
  },
  {
    name: "cmi_schedule_resources",
    title: "Resources (people and trades)",
    description: "Find who can be assigned (q: name search across staff, trade partners and trade labels), or the resource load across all jobs (from YYYY-MM-DD, weeks) to see who's overbooked.",
    risk: "read",
    available: view,
    inputSchema: () => obj({ q: str("Search people / trades"), from: str("YYYY-MM-DD (load view)"), weeks: { type: "integer", minimum: 1, maximum: 26 } }),
    run: async (a) => {
      if (s(a.q)) return { result: { pool: await resourcePool(s(a.q)) } };
      return { result: (await loadResourceView(s(a.from) || new Date().toISOString().slice(0, 10), typeof a.weeks === "number" ? a.weeks : 6)) as unknown as Json };
    },
  },
  {
    name: "cmi_schedule_assign",
    title: "Assign tasks",
    description: "Add, replace or remove people / trades on several tasks at once. resources: [{id, name, type: staff|vendor|contractor|trade}] from cmi_schedule_resources. Assigned staff are notified.",
    risk: "write",
    available: edit,
    inputSchema: () => obj({ ...SID, item_ids: strList("Task ids"), resources: { type: "array", items: { type: "object" } }, mode: { type: "string", enum: ["add", "replace", "remove"] } }, ["schedule_id", "item_ids", "resources"]),
    run: async (a, c) => {
      const n = await assignTasks(s(a.schedule_id), ids(a.item_ids), (a.resources as Assignee[]) ?? [], (s(a.mode) || "add") as "add" | "replace" | "remove", actorOf(c));
      return { result: { tasks_changed: n }, entity: "job_schedule", recordId: s(a.schedule_id) };
    },
  },
  {
    name: "cmi_schedule_participants",
    title: "Schedule participants",
    description: "List, add (name, email, role, company) or remove (participant_id) the outside people on a schedule (subs, designers) who get schedule notices.",
    risk: "write",
    available: view,
    inputSchema: () => obj({ ...SID, action: { type: "string", enum: ["list", "add", "remove"] }, participant_id: str("Participant id (remove)"), name: str("Name"), email: str("Email"), role: str("Role"), company: str("Company") }, ["schedule_id"]),
    run: async (a, c) => {
      const act = s(a.action) || "list";
      if (act === "list") return { result: { participants: await listParticipants(s(a.schedule_id)) } };
      if (!edit(c)) throw new Error(`Your role (${c.ctx.role}) can't change schedules.`);
      if (act === "remove") { await removeParticipant(s(a.participant_id)); return { result: { removed: true }, entity: "schedule_participant", recordId: s(a.participant_id) }; }
      const input: Json = {};
      for (const k of ["name", "email", "role", "company"]) if (s(a[k])) input[k] = s(a[k]);
      const p = await addParticipant(s(a.schedule_id), input);
      return { result: { added: p }, entity: "schedule_participant", recordId: (p as { id: string }).id, after: p };
    },
  },
  {
    name: "cmi_schedule_inspections_add",
    title: "Add inspections to a schedule",
    description: "List the inspections the job's jurisdiction calls for that aren't on the schedule yet (no picks), or add them (picks: [{step_id, count}]) as milestones linked to the work around them.",
    risk: "write",
    available: view,
    inputSchema: () => obj({ ...SID, picks: { type: "array", items: { type: "object" } } }, ["schedule_id"]),
    run: async (a, c) => {
      if (!Array.isArray(a.picks) || !a.picks.length) return { result: (await candidatesForSchedule(s(a.schedule_id))) as unknown as Json };
      if (!edit(c)) throw new Error(`Your role (${c.ctx.role}) can't change schedules.`);
      const r = await applyInspections(s(a.schedule_id), a.picks as never, actorOf(c));
      return { result: r as unknown as Json, entity: "job_schedule", recordId: s(a.schedule_id) };
    },
  },
  {
    name: "cmi_schedule_archive",
    title: "Archive or delete a schedule",
    description: "Archive a schedule (kept, restorable from the schedule list) or, admins only, delete it for good (delete: true). Previews first; runs with cmi_confirm.",
    risk: "high",
    available: manage,
    inputSchema: () => obj({ ...SID, delete: bool("Delete permanently instead of archiving (admins)") }, ["schedule_id"]),
    preview: async (a, c): Promise<Preview> => {
      const name = await schedName(s(a.schedule_id));
      if (a.delete === true && !["super_admin", "admin"].includes(c.ctx.role)) throw new Error("Only an admin can delete a schedule; archive it instead.");
      return { summary: a.delete === true ? `Delete the schedule "${name}" and all its tasks for good.` : `Archive the schedule "${name}" (it can be restored).`, entity: "job_schedule", recordId: s(a.schedule_id) };
    },
    execute: async (a, c) => {
      if (a.delete === true) await deleteSchedule(s(a.schedule_id), actorOf(c)); else await archiveSchedule(s(a.schedule_id), actorOf(c));
      return { result: { [a.delete === true ? "deleted" : "archived"]: true }, entity: "job_schedule", recordId: s(a.schedule_id), after: null };
    },
  },
];

export function scheduleMoreTools(): McpTool[] {
  return [...phaseTools, ...gridTools, ...trackingTools, ...setupTools];
}
