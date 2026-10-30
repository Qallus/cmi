// Phase E MCP tools: finance and reporting. Weekly workload meeting reports
// (Reporting), projections (Super Admin / Admin; every change previewed and
// logged with before/after, and Gauge keeps reading the same numbers),
// change orders (Project Manager, Admin, Super Admin: create, read, update,
// and delete to the restorable trash) and quotes. Thin wrappers over lib/*.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import {
  addAction, createReport, getReport, listReports, loadOpenActions, updateAction, updateItem as updateReportItem,
} from "@/lib/reporting/data";
import { canEditReports, canUseReporting, REPORTING_FLAG } from "@/lib/reporting/access";
import type { ReportItem } from "@/lib/reporting/types";
import { loadDetail, setMonth, updateProjection, type ProjectionPatch } from "@/lib/projections/data";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { createChangeOrder, getChangeOrder, loadChangeOrders, updateChangeOrder } from "@/lib/change-orders/data";
import { CHANGE_ORDER_STATUSES, type ChangeOrderDraft } from "@/lib/change-orders/types";
import { updateQuote } from "@/lib/quotes/data";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { trashRecord } from "./trash";
import { resolveJobId, staffIdFor } from "./tools-crm";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const fields = (description: string) => ({ type: "object", description, additionalProperties: true });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sb = () => getSupabaseAdmin();
const actorOf = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName });
const usd = (n: unknown) => (typeof n === "number" ? `$${n.toLocaleString("en-US")}` : "—");

// ─── Weekly workload reports ────────────────────────────────────────────────

const reportingOn = async (c: McpCaller) => canUseReporting(c.ctx.role) && (await isFeatureEnabled(REPORTING_FLAG));
const reportingEdit = async (c: McpCaller) => canEditReports(c.ctx.role) && (await isFeatureEnabled(REPORTING_FLAG));

const ITEM_FIELDS = ["status_text", "scope", "design_partner", "value_note", "original_completion", "current_completion",
  "warranty_date", "financial_note", "latest_update", "procurement_note", "notes", "title"] as const;

const reportTools: McpTool[] = [
  {
    name: "cmi_reports_list",
    title: "Weekly workload reports",
    description: "The weekly workload meeting reports, newest first, with how many items and open action items each has.",
    risk: "read",
    available: reportingOn,
    inputSchema: () => obj(),
    run: async () => ({ result: { reports: (await listReports()).slice(0, 30) } }),
  },
  {
    name: "cmi_report_get",
    title: "Read a workload report",
    description: "One weekly workload report in full: sections, each job/deal item (status, completion dates, latest update, notes) and its action items.",
    risk: "read",
    available: reportingOn,
    inputSchema: () => obj({ id: str("Report id (from cmi_reports_list)") }, ["id"]),
    run: async (a) => ({ result: (await getReport(s(a.id))) ?? { error: "No report with that id." } }),
  },
  {
    name: "cmi_report_create",
    title: "Start this week's report",
    description: "Create a weekly workload meeting report for a date. By default it fills in every active job and deal from CMI records and carries forward open action items from the previous report.",
    risk: "write",
    available: reportingEdit,
    inputSchema: () => obj({ meeting_date: str("Meeting date YYYY-MM-DD"), title: str("Title (optional)"), populate: { type: "boolean" }, carry_forward: { type: "boolean" } }, ["meeting_date"]),
    run: async (a, c) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s(a.meeting_date))) return { result: { error: "Give meeting_date as YYYY-MM-DD." } };
      const r = await createReport({ meeting_date: s(a.meeting_date), title: s(a.title) || undefined, populate: a.populate !== false, carry_forward: a.carry_forward !== false }, actorOf(c));
      const items = r.sections.reduce((n, sec) => n + sec.items.length, 0);
      return { result: { created: true, id: r.id, title: r.title, items }, entity: "meeting_report", recordId: r.id, before: null, after: { id: r.id, title: r.title, meeting_date: r.meeting_date } };
    },
  },
  {
    name: "cmi_report_item_update",
    title: "Update a report item",
    description: `Update one job/deal row in a workload report: ${ITEM_FIELDS.join(", ")}. Changes are tracked in the report's change history.`,
    risk: "write",
    available: reportingEdit,
    inputSchema: () => obj({ id: str("Report item id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      const { data: before } = await sb().from("report_items").select("*").eq("id", s(a.id)).maybeSingle();
      if (!before) return { result: { error: "No report item with that id." } };
      const patch = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (ITEM_FIELDS as readonly string[]).includes(k)));
      if (!Object.keys(patch).length) return { result: { error: `Change one of: ${ITEM_FIELDS.join(", ")}.` } };
      const after = await updateReportItem(s(a.id), patch as Partial<ReportItem>, actorOf(c));
      return { result: { updated: true, item: after }, entity: "report_item", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_report_action",
    title: "Add or close a report action item",
    description: "Add an action item to a report item (body, owner email, due date), or update one (action_id) — e.g. completed=true to close it.",
    risk: "write",
    available: reportingEdit,
    inputSchema: () => obj({
      item_id: str("Report item id (to add)"), action_id: str("Action item id (to update)"),
      body: str("What needs doing"), owner: str("Owner staff email or id"), due_date: str("YYYY-MM-DD"), completed: { type: "boolean" },
    }),
    run: async (a) => {
      const owner = s(a.owner) ? await staffIdFor(a.owner) : undefined;
      if (s(a.action_id)) {
        const { data: before } = await sb().from("report_action_items").select("*").eq("id", s(a.action_id)).maybeSingle();
        if (!before) return { result: { error: "No action item with that id." } };
        const patch: Json = {};
        if (s(a.body)) patch.body = s(a.body);
        if (owner !== undefined) patch.owner_staff_id = owner;
        if (s(a.due_date)) patch.due_date = s(a.due_date);
        if (typeof a.completed === "boolean") patch.completed_at = a.completed ? new Date().toISOString() : null;
        const after = await updateAction(before.id, patch);
        return { result: { updated: true, action: after }, entity: "report_action_item", recordId: after.id, before, after };
      }
      if (!s(a.item_id) || !s(a.body)) return { result: { error: "To add one, give item_id and body." } };
      const created = await addAction(s(a.item_id), { body: s(a.body), owner_staff_id: owner ?? null, due_date: s(a.due_date) || null });
      return { result: { created: true, action: created }, entity: "report_action_item", recordId: created.id, before: null, after: created };
    },
  },
  {
    name: "cmi_report_open_actions",
    title: "Open report action items",
    description: "Every open action item across the workload reports, with its job and the meeting it came from.",
    risk: "read",
    available: reportingOn,
    inputSchema: () => obj(),
    run: async () => ({ result: { actions: await loadOpenActions() } }),
  },
];

// ─── Projections (Super Admin / Admin) ──────────────────────────────────────

const projectionsOn = async (c: McpCaller) => canUseProjections(c.ctx.role) && (await isFeatureEnabled(PROJECTIONS_FLAG));
const PATCH_KEYS = ["status", "forecast_start", "forecast_finish", "revenue_override", "include", "notes", "name", "client_name", "respread"] as const;

const projectionTools: McpTool[] = [
  {
    name: "cmi_projection_get",
    title: "One projection in detail",
    description: "One job's projection: official vs overridden status, dates and revenue, the month-by-month forecast and actuals, and its recent changes. Projection ids come from cmi_get_projections.",
    risk: "read",
    available: projectionsOn,
    inputSchema: () => obj({ id: str("Projection id") }, ["id"]),
    run: async (a) => ({ result: await loadDetail(s(a.id)) }),
  },
  {
    name: "cmi_projection_update",
    title: "Change a projection",
    description: `Override a projection's ${PATCH_KEYS.filter((k) => k !== "respread").join(", ")} (null puts a field back to the job's own value). respread=true re-spreads the remaining revenue evenly over the forecast window. Super Admin / Admin. Previews first; runs with cmi_confirm; logged with before/after.`,
    risk: "high",
    available: projectionsOn,
    inputSchema: () => obj({ id: str("Projection id"), changes: fields("Fields to change") }, ["id", "changes"]),
    preview: async (a): Promise<Preview> => {
      const d = await loadDetail(s(a.id));
      const changes = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (PATCH_KEYS as readonly string[]).includes(k)));
      if (!Object.keys(changes).length) throw new Error(`Change one of: ${PATCH_KEYS.join(", ")}.`);
      const cur = d.overrides as unknown as Json;
      const lines = Object.entries(changes).map(([k, v]) => `${k}: ${k === "revenue_override" ? usd(cur[k]) : String(cur[k] ?? "—")} → ${k === "revenue_override" ? usd(v) : String(v)}`);
      return { summary: `Change the projection for ${d.row.name}: ${lines.join("; ")}. Gauge and the Projections board will show the new numbers.`, details: { changes }, entity: "projection", recordId: s(a.id) };
    },
    execute: async (a, c) => {
      const before = (await loadDetail(s(a.id))).overrides;
      const changes = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (PATCH_KEYS as readonly string[]).includes(k)));
      await updateProjection(s(a.id), changes as ProjectionPatch, { id: c.ctx.id, name: c.ctx.displayName });
      const after = (await loadDetail(s(a.id))).overrides;
      return { result: { updated: true, overrides: after }, entity: "projection", recordId: s(a.id), before, after };
    },
  },
  {
    name: "cmi_projection_set_month",
    title: "Set a month's projected revenue",
    description: "Set one month's projected billing for a projection. mode 'redistribute' spreads the difference over the other future months so the total stays the same; 'leave' changes only that month. Super Admin / Admin. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: projectionsOn,
    inputSchema: () => obj({ id: str("Projection id"), month: str("Month YYYY-MM"), amount: { type: "number", minimum: 0 }, mode: { type: "string", enum: ["redistribute", "leave"] } }, ["id", "month", "amount"]),
    preview: async (a): Promise<Preview> => {
      const d = await loadDetail(s(a.id));
      if (!/^\d{4}-\d{2}$/.test(s(a.month))) throw new Error("Give month as YYYY-MM.");
      return { summary: `Set ${d.row.name}'s projected billing for ${s(a.month)} to ${usd(a.amount)} (${a.mode === "leave" ? "only that month changes" : "the difference is spread over the other future months"}).`, entity: "projection", recordId: s(a.id) };
    },
    execute: async (a, c) => {
      await setMonth(s(a.id), { month: s(a.month), amount: Number(a.amount), mode: a.mode === "leave" ? "leave" : "redistribute" }, { id: c.ctx.id, name: c.ctx.displayName });
      return { result: { updated: true, month: s(a.month), amount: Number(a.amount) }, entity: "projection", recordId: s(a.id), after: { month: s(a.month), amount: Number(a.amount) } };
    },
  },
];

// ─── Change orders (Project Manager, Admin, Super Admin) ────────────────────

const CO_ROLES = ["super_admin", "admin", "project_manager"];
const coRole = (c: McpCaller) => CO_ROLES.includes(c.ctx.role);
const CO_FIELDS = ["title", "description", "status", "amount", "co_date", "approved_date", "requested_by", "client_visible"] as const;

const changeOrderTools: McpTool[] = [
  {
    name: "cmi_change_orders_list",
    title: "A job's change orders",
    description: "Change orders on a job: number, title, status, amount, dates and whether the client sees it, plus the approved total.",
    risk: "read",
    available: coRole,
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      const list = await loadChangeOrders(job.id);
      const approved = list.filter((x) => x.status === "approved").reduce((n, x) => n + Number(x.amount ?? 0), 0);
      return { result: { job: job.label, approved_total: approved, change_orders: list } };
    },
  },
  {
    name: "cmi_change_order_create",
    title: "Create a change order",
    description: `Create a change order on a job (numbered automatically, e.g. CO-003): title, description, amount, status (${CHANGE_ORDER_STATUSES.join(", ")}; default draft), co_date, requested_by, client_visible (shows it in the client portal).`,
    risk: "write",
    available: coRole,
    inputSchema: () => obj({ job: str("Job id, number or name"), change_order: fields("The change order's fields") }, ["job", "change_order"]),
    run: async (a, c) => {
      const job = await resolveJobId(a.job);
      const draft = Object.fromEntries(Object.entries((a.change_order as Json) ?? {}).filter(([k]) => (CO_FIELDS as readonly string[]).includes(k))) as Json;
      if (!s(draft.title)) return { result: { error: "Give the change order a title." } };
      if (draft.status && !(CHANGE_ORDER_STATUSES as readonly string[]).includes(String(draft.status))) return { result: { error: `status must be one of ${CHANGE_ORDER_STATUSES.join(", ")}.` } };
      const co = await createChangeOrder(job.id, { status: "draft", ...draft } as ChangeOrderDraft, c.ctx.displayName);
      return { result: { created: true, job: job.label, change_order: co }, entity: "change_order", recordId: co.id, before: null, after: co };
    },
  },
  {
    name: "cmi_change_order_update",
    title: "Update a change order",
    description: `Change a change order's ${CO_FIELDS.join(", ")}. Moving it to approved stamps the approval date.`,
    risk: "write",
    available: coRole,
    inputSchema: () => obj({ id: str("Change order id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a) => {
      const before = await getChangeOrder(s(a.id));
      if (!before) return { result: { error: "No change order with that id." } };
      const patch = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (CO_FIELDS as readonly string[]).includes(k)));
      if (patch.status && !(CHANGE_ORDER_STATUSES as readonly string[]).includes(String(patch.status))) return { result: { error: `status must be one of ${CHANGE_ORDER_STATUSES.join(", ")}.` } };
      if (!Object.keys(patch).length) return { result: { error: `Change one of: ${CO_FIELDS.join(", ")}.` } };
      const after = await updateChangeOrder(before.id, patch as Partial<ChangeOrderDraft>);
      return { result: { updated: true, change_order: after }, entity: "change_order", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_change_order_delete",
    title: "Delete a change order",
    description: "Move a change order to the trash (Project Manager, Admin, Super Admin). It can be restored with cmi_restore. Previews first; runs with cmi_confirm. To cancel one that was sent, set its status to void instead.",
    risk: "high",
    capGroup: "trash",
    available: coRole,
    inputSchema: () => obj({ id: str("Change order id") }, ["id"]),
    preview: async (a): Promise<Preview> => {
      const co = await getChangeOrder(s(a.id));
      if (!co) throw new Error("No change order with that id.");
      return { summary: `Move change order ${co.co_number ?? ""} "${co.title}" (${co.status}, ${usd(Number(co.amount ?? 0))}) to the trash. It can be restored.`, entity: "change_order", recordId: co.id };
    },
    execute: async (a, c) => {
      const { trashId, label, before } = await trashRecord("change_order", s(a.id), c.ctx, "mcp");
      return { result: { trashed: true, label, trash_id: trashId }, entity: "change_order", recordId: s(a.id), before, after: null };
    },
  },
];

// ─── Quotes ─────────────────────────────────────────────────────────────────

const QUOTE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const QUOTE_FIELDS = ["status", "project_type", "location", "sq_ft", "budget_range", "timeline", "services", "description", "estimated_value", "source"] as const;

const quoteTools: McpTool[] = [
  {
    name: "cmi_quotes_list",
    title: "Quote requests",
    description: "Quote / lead requests (name, project type, location, budget range, status, estimated value), newest first. Filter by status (New, In Review, Quoted, Won, Lost) or search.",
    risk: "read",
    available: (c) => QUOTE_ROLES.includes(c.ctx.role),
    inputSchema: () => obj({ status: str("New, In Review, Quoted, Won or Lost"), search: str("Name, email or location words"), limit: { type: "integer", minimum: 1, maximum: 100 } }),
    run: async (a) => {
      let q = sb().from("quotes").select("*").order("created_at", { ascending: false }).limit(Math.min(Number(a.limit) || 30, 100));
      if (s(a.status)) q = q.eq("status", s(a.status));
      if (s(a.search)) { const t = s(a.search).replace(/[%_,()]/g, " "); q = q.or(`name.ilike.%${t}%,email.ilike.%${t}%,location.ilike.%${t}%`); }
      const { data, error } = await q;
      return { result: error ? { error: error.message } : { quotes: data ?? [] } };
    },
  },
  {
    name: "cmi_quote_update",
    title: "Update a quote request",
    description: `Change a quote request's ${QUOTE_FIELDS.join(", ")}. Estimated value is limited to roles that can see financials.`,
    risk: "write",
    available: (c) => QUOTE_ROLES.includes(c.ctx.role),
    inputSchema: () => obj({ id: str("Quote id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      const { data: before } = await sb().from("quotes").select("*").eq("id", s(a.id)).maybeSingle();
      if (!before) return { result: { error: "No quote with that id." } };
      const patch = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (QUOTE_FIELDS as readonly string[]).includes(k)));
      if ("estimated_value" in patch && !c.ctx.isAdmin) return { result: { error: "Only roles that can see financials can change the estimated value." } };
      if (!Object.keys(patch).length) return { result: { error: `Change one of: ${QUOTE_FIELDS.join(", ")}.` } };
      const after = await updateQuote(before.id, patch as never);
      return { result: { updated: true, quote: after }, entity: "quote", recordId: after.id, before, after };
    },
  },
];

export function financeTools(): McpTool[] {
  return [...reportTools, ...projectionTools, ...changeOrderTools, ...quoteTools];
}
