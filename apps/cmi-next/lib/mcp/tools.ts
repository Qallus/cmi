// The MCP tool list. Every tool is a thin wrapper over code Bolt already runs
// (lib/agent/tools.ts dispatchTool, lib/briefing, lib/deals), so Claude and
// Bolt see the same data with the same role rules. Phase 1 is read-only.
import { ENTITIES } from "@/lib/agent/entities";
import { dispatchTool, toolDefsFor } from "@/lib/agent/tools";
import { buildBriefing, loadBriefingStaff } from "@/lib/briefing/build";
import { loadDeals } from "@/lib/deals/data";
import type { McpCaller } from "./auth";
import { searchKnowledge } from "./knowledge";
import { entityAllowed, scopeUserEmail } from "./policy";

type Json = Record<string, unknown>;
export type ToolOutput = { result: unknown; targetUserEmail?: string | null };

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: (caller: McpCaller) => Json;
  /** Hidden from tools/list and refused on call when false. */
  available?: (caller: McpCaller) => boolean | Promise<boolean>;
  run: (args: Json, caller: McpCaller) => Promise<ToolOutput>;
};

const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const int = (description: string) => ({ type: "integer", description, minimum: 1, maximum: 100 });

const allowedEntities = (c: McpCaller) => ENTITIES.map((e) => e.key).filter((k) => entityAllowed(k, c.ctx));
const entityParam = (c: McpCaller) => ({ type: "string", enum: allowedEntities(c), description: "Which kind of record. Call cmi_list_entities for descriptions." });

function requireEntity(args: Json, c: McpCaller): string {
  const entity = String(args.entity ?? "");
  if (!entityAllowed(entity, c.ctx) || !ENTITIES.some((e) => e.key === entity)) {
    throw new Error(`"${entity}" isn't available to you through Claude.`);
  }
  return entity;
}

/** Run a Bolt tool and unwrap its result. */
async function bolt(name: string, args: Json, c: McpCaller): Promise<ToolOutput> {
  const out = await dispatchTool(name, args, c.ctx);
  if (out.pending) throw new Error("This action needs confirmation in the CMI dashboard and isn't available through Claude yet.");
  return { result: out.result };
}

async function staffByEmail(email: string) {
  const staff = (await loadBriefingStaff()).find((s) => s.email.toLowerCase() === email);
  if (!staff) throw new Error(`No active CMI staff member with the email ${email}.`);
  return staff;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "cmi_list_entities",
    title: "List CMI record types",
    description: "List the kinds of CMI dashboard records you can read (jobs, contacts, daily logs, meetings, documents, selections and more), with a one-line description of each.",
    inputSchema: () => obj(),
    run: async (_a, c) => {
      const { result } = await bolt("list_entities", {}, c);
      const list = ((result as { entities?: { key: string }[] }).entities ?? []).filter((e) => entityAllowed(e.key, c.ctx));
      return { result: { entities: list } };
    },
  },
  {
    name: "cmi_describe_entity",
    title: "Describe a record type",
    description: "Show every field of one CMI record type (name, type, allowed values). Use before filtering by a field you haven't seen.",
    inputSchema: (c) => obj({ entity: entityParam(c) }, ["entity"]),
    run: (a, c) => bolt("describe_entity", { entity: requireEntity(a, c) }, c),
  },
  {
    name: "cmi_list_records",
    title: "Search CMI records",
    description: "Search or list CMI dashboard records of one type. `search` matches names/titles/emails (all words must match). `filters` are exact field matches, e.g. {\"status\":\"active_project\"}. Returns `total` plus up to `limit` rows.",
    inputSchema: (c) => obj({
      entity: entityParam(c), search: str("Keywords"),
      filters: { type: "object", description: "Exact field matches", additionalProperties: true },
      limit: int("Max rows (default 20)"),
    }, ["entity"]),
    run: (a, c) => bolt("list_records", { entity: requireEntity(a, c), search: a.search, filters: a.filters, limit: a.limit }, c),
  },
  {
    name: "cmi_get_record",
    title: "Get one CMI record",
    description: "Read one CMI record in full by its id.",
    inputSchema: (c) => obj({ entity: entityParam(c), id: str("Record id") }, ["entity", "id"]),
    run: (a, c) => bolt("get_record", { entity: requireEntity(a, c), id: a.id }, c),
  },
  {
    name: "cmi_count_records",
    title: "Count CMI records",
    description: "Exact database count of CMI records, optionally filtered and grouped by one field (e.g. jobs by status, contacts by type). Use for every 'how many' question.",
    inputSchema: (c) => obj({
      entity: entityParam(c), search: str("Keywords"),
      filters: { type: "object", additionalProperties: true }, group_by: str("Field to group the count by"),
    }, ["entity"]),
    run: (a, c) => bolt("count_records", { entity: requireEntity(a, c), search: a.search, filters: a.filters, group_by: a.group_by }, c),
  },
  {
    name: "cmi_get_project",
    title: "Job overview",
    description: "Everything about one job: details, team, schedule, recent daily logs, open action items, selections, files and notes. Accepts a job id, job number (e.g. 26_014) or part of the name.",
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: (a, c) => bolt("get_job_overview", { job: a.job }, c),
  },
  {
    name: "cmi_list_projects",
    title: "List jobs",
    description: "List CMI jobs, optionally by status (e.g. active_project, pre_construction_design, warranty) or keywords.",
    inputSchema: () => obj({ status: str("Job status"), search: str("Keywords: name, number, address, client"), limit: int("Max rows (default 25)") }),
    run: (a, c) => bolt("list_records", { entity: "job", search: a.search, filters: a.status ? { status: a.status } : undefined, limit: a.limit ?? 25 }, c),
  },
  {
    name: "cmi_list_pipeline",
    title: "Sales pipeline",
    description: "The sales pipeline: early deals (New → Contacted → Qualified → Opportunity → Proposal → Negotiation → Closed Won/Lost) and Pre-Con projects after Closed Won. Optional stage and keyword filters.",
    inputSchema: () => obj({ stage: str("Deal or Pre-Con stage"), search: str("Keywords"), limit: int("Max rows per list (default 25)") }),
    run: async (a, c) => {
      const limit = Math.min(Number(a.limit) || 25, 100);
      const needle = typeof a.search === "string" ? a.search.toLowerCase() : "";
      const deals = (await loadDeals())
        .filter((d) => (!a.stage || d.stage === a.stage) && (!needle || [d.title, d.city, d.full_address, d.job_type, d.source].some((v) => v?.toLowerCase().includes(needle))))
        .slice(0, limit)
        .map((d) => ({
          id: d.id, title: d.title, stage: d.stage, city: d.city, job_type: d.job_type, estimated_value: d.estimated_value,
          probability: d.probability, owner_id: d.owner_id, expected_close_date: d.expected_close_date,
          next_action: d.next_action, next_action_due: d.next_action_due, last_activity_at: d.last_activity_at, job_number: d.job_number,
        }));
      const precon = await dispatchTool("list_records", { entity: "opportunity", search: a.search, filters: a.stage ? { stage: a.stage } : undefined, limit }, c.ctx);
      return { result: { deals, precon: precon.result } };
    },
  },
  {
    name: "cmi_get_projections",
    title: "Revenue projections",
    description: "The 12-month revenue forecast from the Projections module: monthly projected vs actual billing, backlog and the largest projects. These are the only approved forecast numbers; never estimate your own.",
    inputSchema: () => obj(),
    available: async (c) => (await toolDefsFor(c.ctx)).some((t) => t?.function?.name === "get_projections_summary"),
    run: (_a, c) => bolt("get_projections_summary", {}, c),
  },
  {
    name: "cmi_list_files",
    title: "Job files",
    description: "File metadata (names, folders, dates, who uploaded) for a job's Files tab. File contents aren't returned.",
    inputSchema: () => obj({ job_id: str("Job id (from cmi_get_project or cmi_list_projects)"), search: str("File name keywords"), limit: int("Max rows (default 25)") }),
    run: (a, c) => bolt("list_records", { entity: "job_file", search: a.search, filters: a.job_id ? { job_id: a.job_id } : undefined, limit: a.limit ?? 25 }, c),
  },
  {
    name: "cmi_list_tasks_due",
    title: "My tasks and meetings",
    description: "Today's meetings and the person's tasks (overdue, due today, due this week) plus items needing attention, from CMI's daily briefing data. Defaults to you; reading someone else's needs company-wide access.",
    inputSchema: () => obj({ user_email: str("Staff email (optional; defaults to you)") }),
    run: async (a, c) => {
      const email = scopeUserEmail(a.user_email, { email: c.ctx.email, companyWide: c.companyWide });
      const b = await buildBriefing(await staffByEmail(email));
      return { result: { person: b.staff.name, date: b.dateLabel, meetings: b.meetings, tasks: b.tasks, attention: b.attention }, targetUserEmail: email };
    },
  },
  {
    name: "cmi_team_directory",
    title: "Team directory",
    description: "Who's who at CMI: names, roles, phone and email. Optional name to look someone up (nicknames work).",
    inputSchema: () => obj({ name: str("Person's name (optional)") }),
    run: (a, c) => bolt("team_directory", { name: a.name }, c),
  },
  {
    name: "cmi_dashboard_help",
    title: "Dashboard help",
    description: "Where something is in the CMI dashboard and how to do it, with a direct link.",
    inputSchema: () => obj({ query: str("What the person wants to find or do") }, ["query"]),
    run: (a, c) => bolt("dashboard_help", { query: a.query }, c),
  },
  {
    name: "cmi_search_knowledge",
    title: "Search CMI knowledge base",
    description: "Search CMI's approved knowledge base: SOPs, policies, templates, standards and roles. Prefer this over guessing how CMI does something.",
    inputSchema: () => obj({ query: str("What to look for"), category: str("Optional category"), limit: { type: "integer", minimum: 1, maximum: 10 } }, ["query"]),
    run: async (a, c) => ({ result: await searchKnowledge(c, String(a.query ?? ""), { category: a.category as string | undefined, limit: a.limit as number | undefined }) }),
  },
];

export async function toolsFor(caller: McpCaller): Promise<McpTool[]> {
  const out: McpTool[] = [];
  for (const t of MCP_TOOLS) if (!t.available || (await t.available(caller))) out.push(t);
  return out;
}
