// MCP tools for job selections (finishes, fixtures, materials): list a job's
// selections, read one, create, update, duplicate, attach existing ones from
// the library, and send one to the client for approval. Sending for approval
// notifies the client, so it previews first and runs with cmi_confirm; plain
// create/update never notify (approval_status "pending" + client_visible is
// refused there). Selections have comments, documents and history hanging off
// them, so AI never deletes one: mark it canceled or replaced instead.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEntity } from "@/lib/agent/entities";
import { canWrite } from "@/lib/agent/registry";
import { attachSelectionsToJob, createJobSelection, loadJobSelections, updateJobSelection } from "@/lib/job-selections/data";
import { duplicateSelection } from "@/lib/selections/duplicate";
import type { ProjectSelection } from "@/lib/selections/types";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { moneyKeysIn } from "./policy";
import { resolveJobId } from "./tools-crm";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const fields = (description: string) => ({ type: "object", description, additionalProperties: true });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const SELECTION_STATUSES = ["draft", "needs_review", "pending_client_approval", "client_approved", "rejected_needs_revision", "approved_internally",
  "ordered", "backordered", "delivered", "installed", "canceled", "replaced", "completed"];
const PROCUREMENT = ["not_ordered", "quote_requested", "quote_received", "ready_to_order", "ordered", "backordered", "partially_delivered", "delivered", "canceled"];
const INSTALL = ["not_ready", "ready_for_install", "scheduled", "in_progress", "installed", "needs_correction", "completed"];

/** Fields Claude may set. Money fields additionally need a financial role. */
const EDITABLE = [
  "name", "room_area_name", "category", "manufacturer", "sku", "model_number", "size", "finish", "colors", "custom_product_name",
  "description", "image_url", "product_url", "spec_sheet_url", "vendor_name", "subcontractor_name", "designer_name",
  "selection_status", "procurement_status", "install_status", "client_visible", "client_approval_required",
  "quantity", "unit", "allowance_amount", "estimated_cost", "actual_cost", "client_price", "lead_time_days",
  "target_decision_date", "target_order_date", "target_delivery_date", "target_install_date", "internal_notes",
] as const;

const FIELD_HELP = `Fields: name, room_area_name, category, manufacturer, sku, model_number, size, finish, colors, description, image_url, product_url, spec_sheet_url, vendor_name, subcontractor_name, designer_name, selection_status (${SELECTION_STATUSES.join(", ")}), procurement_status (${PROCUREMENT.join(", ")}), install_status (${INSTALL.join(", ")}), client_visible, quantity, unit, allowance_amount / estimated_cost / actual_cost / client_price (financial roles), lead_time_days, target_decision_date, target_order_date, target_delivery_date, target_install_date, internal_notes.`;

function gate(c: McpCaller) {
  const e = getEntity("selection");
  if (!e || !canWrite(e, c.ctx)) throw new Error(`Your role (${c.ctx.role}) can't change selections.`);
}

/** Keep known fields, check enums and money, and never send for approval from here. */
function cleanPatch(c: McpCaller, raw: unknown, current?: ProjectSelection): Json {
  const patch: Json = Object.fromEntries(Object.entries((raw as Json) ?? {}).filter(([k]) => (EDITABLE as readonly string[]).includes(k)));
  const bad = (k: string, list: string[]) => patch[k] !== undefined && !list.includes(String(patch[k]));
  if (bad("selection_status", SELECTION_STATUSES)) throw new Error(`selection_status must be one of: ${SELECTION_STATUSES.join(", ")}.`);
  if (bad("procurement_status", PROCUREMENT)) throw new Error(`procurement_status must be one of: ${PROCUREMENT.join(", ")}.`);
  if (bad("install_status", INSTALL)) throw new Error(`install_status must be one of: ${INSTALL.join(", ")}.`);
  if (!c.ctx.isAdmin) {
    const money = moneyKeysIn(patch).concat(["allowance_amount"].filter((k) => k in patch));
    if (money.length) throw new Error(`Only roles that can see financials can set ${[...new Set(money)].join(", ")}.`);
  }
  if (patch.selection_status === "pending_client_approval" || (current?.approval_status === "pending" && patch.client_visible === true && !current.client_visible)) {
    throw new Error("Sending a selection to the client goes through cmi_selection_send_for_approval, so it's previewed first.");
  }
  return patch;
}

const brief = (x: ProjectSelection) => ({
  id: x.id, name: x.name, room: x.room_area_name, category: x.category, product: [x.manufacturer, x.custom_product_name, x.model_number].filter(Boolean).join(" ") || null,
  finish: x.finish, quantity: x.quantity, status: x.selection_status, approval: x.approval_status, procurement: x.procurement_status, install: x.install_status,
  client_visible: x.client_visible, decide_by: x.target_decision_date, deliver_by: x.target_delivery_date,
  estimated_cost: x.estimated_cost, client_price: x.client_price,
});

async function selection(id: string): Promise<ProjectSelection> {
  const { data } = await getSupabaseAdmin().from("project_selections").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("No selection with that id.");
  return data as ProjectSelection;
}

export function selectionTools(): McpTool[] {
  return [
    {
      name: "cmi_selections_list",
      title: "A job's selections",
      description: "Selections on a job (finishes, fixtures, materials) with room, product, quantity and status: selection, client approval, procurement and install. Filter by room, category or what's outstanding (needs_decision, not_ordered, late).",
      risk: "read",
      inputSchema: () => obj({ job: str("Job id, number or name"), room: str("Room / area"), category: str("Category"), outstanding: { type: "string", enum: ["needs_decision", "not_ordered", "late"] } }, ["job"]),
      run: async (a) => {
        const job = await resolveJobId(a.job);
        let rows = await loadJobSelections(job.id);
        const today = new Date().toISOString().slice(0, 10);
        if (s(a.room)) rows = rows.filter((x) => (x.room_area_name ?? "").toLowerCase().includes(s(a.room).toLowerCase()));
        if (s(a.category)) rows = rows.filter((x) => (x.category ?? "").toLowerCase().includes(s(a.category).toLowerCase()));
        if (a.outstanding === "needs_decision") rows = rows.filter((x) => !["approved", "approved_with_changes", "not_required"].includes(x.approval_status) || ["draft", "needs_review"].includes(x.selection_status));
        if (a.outstanding === "not_ordered") rows = rows.filter((x) => ["not_ordered", "quote_requested", "quote_received", "ready_to_order"].includes(x.procurement_status));
        if (a.outstanding === "late") rows = rows.filter((x) => (!!x.target_decision_date && x.target_decision_date < today && x.approval_status !== "approved") || (!!x.target_delivery_date && x.target_delivery_date < today && x.procurement_status !== "delivered"));
        return { result: { job: job.label, count: rows.length, selections: rows.slice(0, 150).map(brief) } };
      },
    },
    {
      name: "cmi_selection_get",
      title: "One selection in full",
      description: "Everything on one selection: product details, links, dates, costs (financial roles), statuses and client comments.",
      risk: "read",
      inputSchema: () => obj({ id: str("Selection id") }, ["id"]),
      run: async (a) => ({ result: await selection(s(a.id)) }),
    },
    {
      name: "cmi_selection_create",
      title: "Add a selection",
      description: `Add a selection to a job. name is required. ${FIELD_HELP} To ask the client to approve it, create it, then use cmi_selection_send_for_approval.`,
      risk: "write",
      inputSchema: () => obj({ job: str("Job id, number or name"), selection: fields("The selection's fields") }, ["job", "selection"]),
      run: async (a, c) => {
        gate(c);
        const job = await resolveJobId(a.job);
        const patch = cleanPatch(c, a.selection);
        if (!s(patch.name)) return { result: { error: "Give the selection a name (e.g. 'Kitchen faucet')." } };
        const row = await createJobSelection(job.id, { selection_status: "draft", approval_status: "not_required", ...patch, name: s(patch.name) } as never);
        return { result: { created: true, job: job.label, selection: brief(row) }, entity: "selection", recordId: row.id, before: null, after: row };
      },
    },
    {
      name: "cmi_selection_update",
      title: "Update a selection",
      description: `Change a selection: product details, quantity, dates, statuses (e.g. procurement_status ordered, install_status installed), costs (financial roles). ${FIELD_HELP} To retire one, set selection_status to canceled or replaced (selections aren't deleted through AI).`,
      risk: "write",
      inputSchema: () => obj({ id: str("Selection id"), changes: fields("Fields to change") }, ["id", "changes"]),
      run: async (a, c) => {
        gate(c);
        const before = await selection(s(a.id));
        const patch = cleanPatch(c, a.changes, before);
        if (!Object.keys(patch).length) return { result: { error: "Nothing to change." } };
        const after = await updateJobSelection(before.id, patch as never);
        return { result: { updated: true, selection: brief(after) }, entity: "selection", recordId: after.id, before, after };
      },
    },
    {
      name: "cmi_selection_duplicate",
      title: "Duplicate a selection",
      description: "Copy a selection (all product details and images) as a fresh draft, optionally onto another job or room. The copy starts without any client approval.",
      risk: "write",
      inputSchema: () => obj({ id: str("Selection to copy"), job: str("Put the copy on this job (optional)"), room: str("Room / area for the copy (optional)") }, ["id"]),
      run: async (a, c) => {
        gate(c);
        const overrides: Json = {};
        if (s(a.job)) overrides.job_id = (await resolveJobId(a.job)).id;
        if (s(a.room)) overrides.room_area_name = s(a.room);
        const row = await duplicateSelection(s(a.id), overrides);
        return { result: { created: true, selection: brief(row) }, entity: "selection", recordId: row.id, before: null, after: row };
      },
    },
    {
      name: "cmi_selection_attach",
      title: "Reuse selections on a job",
      description: "Attach existing selections (e.g. from another job or the library) to a job without moving them. Find them with cmi_list_records (entity selection) or cmi_selections_list on the other job.",
      risk: "write",
      inputSchema: () => obj({ job: str("Job id, number or name"), selection_ids: { type: "array", items: { type: "string" } } }, ["job", "selection_ids"]),
      run: async (a, c) => {
        gate(c);
        const job = await resolveJobId(a.job);
        const ids = (Array.isArray(a.selection_ids) ? a.selection_ids : []).map(String).filter(Boolean);
        if (!ids.length) return { result: { error: "Give at least one selection id." } };
        const rows = await attachSelectionsToJob(job.id, ids, c.ctx.id);
        return { result: { attached: rows.length, job: job.label, selections: rows.map(brief) }, entity: "job", recordId: job.id, after: { attached: ids } };
      },
    },
    {
      name: "cmi_selection_send_for_approval",
      title: "Send selections to the client for approval",
      description: "Ask the client to approve one or more selections: they become visible in the client portal as pending, and the job's clients are notified. Previews first; runs with cmi_confirm.",
      risk: "high",
      openWorld: true,
      inputSchema: () => obj({ ids: { type: "array", items: { type: "string" }, description: "Selection ids" }, decide_by: str("Decision date YYYY-MM-DD (optional)") }, ["ids"]),
      available: (c) => { const e = getEntity("selection"); return !!e && canWrite(e, c.ctx); },
      preview: async (a): Promise<Preview> => {
        const ids = (Array.isArray(a.ids) ? a.ids : []).map(String);
        if (!ids.length) throw new Error("Give at least one selection id.");
        const { data } = await getSupabaseAdmin().from("project_selections").select("id, name, room_area_name, job_id").in("id", ids);
        const rows = (data ?? []) as { id: string; name: string; room_area_name: string | null; job_id: string | null }[];
        if (rows.length !== ids.length) throw new Error("Some of those selections don't exist.");
        if (rows.some((r) => !r.job_id)) throw new Error("Only selections on a job can be sent to its client.");
        const names = rows.map((r) => `${r.name}${r.room_area_name ? ` (${r.room_area_name})` : ""}`);
        return { summary: `Send ${names.length} selection${names.length === 1 ? "" : "s"} to the client for approval: ${names.join(", ")}. The job's clients are notified and see them in their portal.`, details: { selections: names, decide_by: s(a.decide_by) || null }, entity: "selection" };
      },
      execute: async (a) => {
        const ids = (a.ids as string[]).map(String);
        const sent = [];
        for (const id of ids) {
          const before = await selection(id);
          const row = await updateJobSelection(id, {
            approval_status: "pending", selection_status: "pending_client_approval", client_visible: true, client_approval_required: true,
            ...(s(a.decide_by) ? { target_decision_date: s(a.decide_by) } : {}),
          } as never);
          sent.push({ id: row.id, name: row.name, was: before.approval_status });
        }
        return { result: { sent: sent.length, selections: sent }, entity: "selection", after: { sent: ids } };
      },
    },
  ];
}
