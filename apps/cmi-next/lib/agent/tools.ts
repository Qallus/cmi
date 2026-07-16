// OpenAI-compatible tool (function) definitions for Bolt + the dispatcher that
// executes them. Reads/creates/updates run inline; deletes and sends are staged
// as pending actions for the staff member to confirm.
import { ENTITIES, getEntity } from "./entities";
import { getJobOverview } from "./job-context";
import {
  createRecord, deleteRecord, getRecord, listRecords, sendMessage, updateRecord,
} from "./registry";
import type { PendingAction, StaffContext, ToolActivity, ToolResult } from "./types";

const entityEnum = ENTITIES.map((e) => e.key);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_DEFS: any[] = [
  {
    type: "function",
    function: {
      name: "list_entities",
      description: "List every dashboard entity Bolt can work with (key, label, purpose).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_entity",
      description: "Get the full field schema for one entity — every field, its type, allowed values, and which are required. Call this before creating or updating records you're unsure about.",
      parameters: {
        type: "object",
        properties: { entity: { type: "string", enum: entityEnum, description: "Entity key" } },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_job_overview",
      description: "Load a full snapshot of ONE construction job in a single call: the job record plus its projects, tasks/milestones, change orders, invoices (with open balance), daily logs, selections, client updates, action items, internal notes, contacts, vendors, and assigned staff. Use this FIRST whenever the user asks about a specific job or says 'this job' — it's far more efficient than many list_records calls. Then use get_record/list_records to drill in, or create/update/delete to act on a child.",
      parameters: {
        type: "object",
        properties: { job: { type: "string", description: "Job id (uuid), job number (e.g. 25_014_Smith), or part of the job name/address" } },
        required: ["job"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_records",
      description: "List/search records of an entity. Use filters for exact field matches and search for keyword lookups.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: entityEnum },
          search: { type: "string", description: "Keyword to search common text fields" },
          filters: { type: "object", description: "Exact field matches, e.g. {\"status\":\"New\"}", additionalProperties: true },
          limit: { type: "number", description: "Max rows (default 20, max 50)" },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_record",
      description: "Fetch a single record by id.",
      parameters: {
        type: "object",
        properties: { entity: { type: "string", enum: entityEnum }, id: { type: "string" } },
        required: ["entity", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_record",
      description: "Create a new record. Provide field values in `data`. Call describe_entity first if unsure about fields.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: entityEnum },
          data: { type: "object", description: "Field values keyed by field name", additionalProperties: true },
        },
        required: ["entity", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_record",
      description: "Update fields on an existing record by id. Only include fields you want to change in `data`.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: entityEnum },
          id: { type: "string" },
          data: { type: "object", additionalProperties: true },
        },
        required: ["entity", "id", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_record",
      description: "Delete a record by id. This is destructive and will be staged for the staff member to confirm before it runs.",
      parameters: {
        type: "object",
        properties: { entity: { type: "string", enum: entityEnum }, id: { type: "string" } },
        required: ["entity", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send an email or SMS to a person. This is outward-facing and will be staged for the staff member to confirm before sending.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "sms"] },
          to: { type: "string", description: "Recipient email address or phone number" },
          subject: { type: "string", description: "Email subject (email only)" },
          body: { type: "string", description: "Message body" },
          contact_id: { type: "string", description: "Optional linked contact id" },
        },
        required: ["channel", "to", "body"],
      },
    },
  },
];

function uid(): string {
  try { return crypto.randomUUID(); } catch { return `pa-${Date.now()}-${Math.round(Math.random() * 1e6)}`; }
}

export type DispatchOutcome = { result: ToolResult; pending?: PendingAction; activity: ToolActivity };

export async function dispatchTool(name: string, args: Record<string, unknown>, ctx: StaffContext): Promise<DispatchOutcome> {
  const act = (summary: string, ok = true): ToolActivity => ({ tool: name, summary, ok });

  try {
    switch (name) {
      case "list_entities":
        return { result: { entities: ENTITIES.map((e) => ({ key: e.key, label: e.label, description: e.description })) }, activity: act("Listed available data types") };

      case "describe_entity": {
        const e = getEntity(String(args.entity));
        if (!e) return { result: { error: `Unknown entity "${args.entity}".` }, activity: act(`Unknown entity ${args.entity}`, false) };
        return { result: { key: e.key, label: e.label, description: e.description, writeRoles: e.writeRoles, fields: e.fields }, activity: act(`Described ${e.label} fields`) };
      }

      case "get_job_overview": {
        const r = await getJobOverview(String(args.job ?? ""));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const label = (r as any)?.job?.job_number || (r as any)?.job?.job_name;
        return { result: r, activity: act(r.error ? String(r.error) : `Loaded job overview${label ? ` for ${label}` : ""}`, !r.error) };
      }

      case "list_records": {
        const r = await listRecords(String(args.entity), { search: args.search as string, filters: args.filters as Record<string, unknown>, limit: args.limit as number });
        return { result: r, activity: act(r.error ? `Search failed: ${r.error}` : `Found ${r.count ?? 0} ${String(args.entity)} record(s)`, !r.error) };
      }

      case "get_record": {
        const r = await getRecord(String(args.entity), String(args.id));
        return { result: r, activity: act(r.error ? r.error as string : `Read ${String(args.entity)} ${String(args.id)}`, !r.error) };
      }

      case "create_record": {
        const r = await createRecord(String(args.entity), (args.data as Record<string, unknown>) || {}, ctx);
        return { result: r, activity: act(r.error ? `Create failed: ${r.error}` : `Created ${String(args.entity)}`, !r.error) };
      }

      case "update_record": {
        const r = await updateRecord(String(args.entity), String(args.id), (args.data as Record<string, unknown>) || {}, ctx);
        return { result: r, activity: act(r.error ? `Update failed: ${r.error}` : `Updated ${String(args.entity)} ${String(args.id)}`, !r.error) };
      }

      case "delete_record": {
        const e = getEntity(String(args.entity));
        const summary = `Delete ${e?.label || args.entity} ${String(args.id)}`;
        const pending: PendingAction = { id: uid(), kind: "delete", summary, entity: String(args.entity), recordId: String(args.id) };
        return { result: { status: "confirmation_required", message: "Staged for staff confirmation. Tell the user to confirm to proceed.", summary }, pending, activity: act(`Staged: ${summary}`) };
      }

      case "send_message": {
        const channel = args.channel === "sms" ? "sms" : "email";
        const summary = `Send ${channel} to ${String(args.to)}`;
        const pending: PendingAction = {
          id: uid(), kind: "send", summary, channel,
          to: String(args.to), subject: args.subject ? String(args.subject) : undefined,
          body: String(args.body || ""), contactId: (args.contact_id as string) ?? null,
        };
        return { result: { status: "confirmation_required", message: "Staged for staff confirmation. Tell the user to confirm to send.", summary }, pending, activity: act(`Staged: ${summary}`) };
      }

      default:
        return { result: { error: `Unknown tool "${name}".` }, activity: act(`Unknown tool ${name}`, false) };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool error.";
    return { result: { error: msg }, activity: act(`Error: ${msg}`, false) };
  }
}

// Executes a confirmed pending action (delete or send). Used by /api/agent/execute.
export async function executePending(action: PendingAction, ctx: StaffContext): Promise<ToolResult> {
  if (action.kind === "delete" && action.entity && action.recordId) {
    return deleteRecord(action.entity, action.recordId, ctx);
  }
  if (action.kind === "send" && action.channel && action.to) {
    return sendMessage({ channel: action.channel, to: action.to, subject: action.subject, body: action.body || "", contactId: action.contactId ?? null }, ctx);
  }
  return { error: "Invalid action." };
}
