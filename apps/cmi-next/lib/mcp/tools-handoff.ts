// MCP tools for moving projects between Pipeline → Pre-Con → Jobs (one home per
// project, lib/handoff), pins, creating jobs properly, and the deal, lead and
// quote actions the dashboard has: deal contacts and checklist, rename,
// duplicate, unarchive, add a contact / quote / form submission to the Pipeline,
// convert a submission, create a quote.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { moveJobBackToPrecon, movePreconBackToPipeline } from "@/lib/handoff/move";
import { pinnedForArea, pinsForRecord, pinRecord, unpin } from "@/lib/handoff/pins";
import { homeOf, AREA_LABEL, type Area } from "@/lib/handoff/home";
import type { PinRecordType } from "@/lib/handoff/pins-core";
import { createJob, createJobFromTemplate, convertOpportunityToJob, loadTemplates } from "@/lib/jobs/data";
import { ALL_JOB_STATUSES } from "@/lib/jobs/status";
import { listDealContacts, addDealContact, updateDealContact, removeDealContact } from "@/lib/deals/contacts";
import {
  loadChecklistProgress, loadChecklistItems, setChecklistItem, createChecklistItem, updateChecklistItem, deleteChecklistItem,
  renameDeal, duplicateDeal, unarchiveDeal, addContactToPipeline, addQuoteToPipeline, addSubmissionToPipeline,
} from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";
import { DEAL_STAGES } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/deals/types";
import { convertSubmissionToContact, convertSubmissionToDeal, convertSubmissionToLead } from "@/lib/contact-submissions/data";
import { createQuote } from "@/lib/quotes/data";
import { WRITE_ROLES } from "@/lib/records-io/fields";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { resolveJobId } from "./tools-crm";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sb = () => getSupabaseAdmin();
const actorOf = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName || c.ctx.email });
const isAdmin = (c: McpCaller) => ["super_admin", "admin"].includes(c.ctx.role);
const jobWrite = (c: McpCaller) => WRITE_ROLES.jobs.includes(c.ctx.role);
const preconWrite = (c: McpCaller) => WRITE_ROLES.precon.includes(c.ctx.role);
const dealWrite = (c: McpCaller) => canWriteDeals(c.ctx.role);
const anyStaff = () => true;
const AREAS: Area[] = ["pipeline", "precon", "jobs"];

async function opp(id: string) {
  const { data } = await sb().from("pipeline_opportunities").select("id, opportunity_name, job_number, stage, archived_at").eq("id", id).maybeSingle();
  if (!data) throw new Error("No Pre-Con record with that id.");
  return data as { id: string; opportunity_name: string; job_number: string | null; stage: string; archived_at: string | null };
}

// ─── Where a project lives, moves back, pins ─────────────────────────────────

const moveTools: McpTool[] = [
  {
    name: "cmi_project_home",
    title: "Where a project lives now",
    description: "One home per project: a project is in exactly one of Pipeline → Pre-Con → Jobs. Give a deal_id, opportunity_id (Pre-Con) or job and get where it lives now, with the linked deal, Pre-Con record and job.",
    risk: "read",
    available: anyStaff,
    inputSchema: () => obj({ deal_id: str("Deal id"), opportunity_id: str("Pre-Con record id"), job: str("Job id, number or name") }),
    run: async (a) => {
      let oppId = s(a.opportunity_id) || null;
      let deal: Json | null = null, job: Json | null = null;
      if (s(a.deal_id)) {
        const { data } = await sb().from("deals").select("id, title, stage, opportunity_id, archived_at").eq("id", s(a.deal_id)).maybeSingle();
        deal = data; oppId = oppId ?? ((data?.opportunity_id as string | null) ?? null);
      }
      if (s(a.job)) {
        const j = await resolveJobId(a.job);
        const { data } = await sb().from("jobs").select("id, job_number, job_name, status, archived_at, related_opportunity_id").eq("id", j.id).maybeSingle();
        job = data; oppId = oppId ?? ((data?.related_opportunity_id as string | null) ?? null);
      }
      const pre = oppId ? await opp(oppId).catch(() => null) : null;
      if (pre && !deal) { const { data } = await sb().from("deals").select("id, title, stage, opportunity_id, archived_at").eq("opportunity_id", pre.id).order("updated_at", { ascending: false }).limit(1); deal = data?.[0] ?? null; }
      if (pre && !job) { const { data } = await sb().from("jobs").select("id, job_number, job_name, status, archived_at").eq("related_opportunity_id", pre.id).is("archived_at", null).limit(1); job = data?.[0] ?? null; }
      const home = homeOf({ deal: deal as never, precon: pre as never, job: job as never });
      return { result: { home: home ? AREA_LABEL[home] : null, deal, precon: pre, job } };
    },
  },
  {
    name: "cmi_job_move_back",
    title: "Move a Job back to Pre-Con",
    description: "Move a project from Jobs back to Pre-Con: the Job is archived (schedules, logs, files and selections kept) and its Pre-Con record comes back at Pre-Construction / Design. Moving it to Active Project again restores the same Job. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: jobWrite,
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      return { summary: `Move ${job.label} back to Pre-Con. The Job is archived (nothing deleted) and returns as it is when the project moves forward again.`, entity: "job", recordId: job.id };
    },
    execute: async (a, c) => {
      const job = await resolveJobId(a.job);
      const r = await moveJobBackToPrecon(job.id, actorOf(c), { canReopen: isAdmin(c) });
      return { result: { moved: "Jobs → Pre-Con", job: job.label, opportunity_id: r.opportunityId }, entity: "job", recordId: job.id };
    },
  },
  {
    name: "cmi_precon_move_back",
    title: "Move a Pre-Con project back to the Pipeline",
    description: `Move a project from Pre-Con back to the Pipeline at a deal stage (${DEAL_STAGES.filter((x) => x !== "closed_won").join(", ")}; default negotiation). The Pre-Con record is archived with its number and returns when the deal is Closed Won again. A project in Jobs has to be moved back to Pre-Con first. Previews first; runs with cmi_confirm.`,
    risk: "high",
    available: preconWrite,
    inputSchema: () => obj({ opportunity_id: str("Pre-Con record id"), stage: { type: "string", enum: DEAL_STAGES.filter((x) => x !== "closed_won") } }, ["opportunity_id"]),
    preview: async (a): Promise<Preview> => {
      const o = await opp(s(a.opportunity_id));
      return { summary: `Move ${o.opportunity_name} (${o.job_number ?? "no number"}) back to the Pipeline at ${s(a.stage) || "negotiation"}.`, entity: "opportunity", recordId: o.id };
    },
    execute: async (a, c) => {
      const r = await movePreconBackToPipeline(s(a.opportunity_id), ((s(a.stage) || "negotiation") as DealStage), actorOf(c));
      return { result: { moved: "Pre-Con → Pipeline", deal_id: r.dealId }, entity: "opportunity", recordId: s(a.opportunity_id) };
    },
  },
  {
    name: "cmi_pins",
    title: "Pinned projects",
    description: "Pins show a project on another board without moving it. Give area (pipeline, precon, jobs) for the cards pinned there, or record_type (deal, precon, job) + record_id for where that record is pinned.",
    risk: "read",
    available: anyStaff,
    inputSchema: () => obj({ area: { type: "string", enum: AREAS }, record_type: { type: "string", enum: ["deal", "precon", "job"] }, record_id: str("Record id") }),
    run: async (a) => {
      if (s(a.area)) return { result: await pinnedForArea(s(a.area) as Area) };
      if (!s(a.record_type) || !s(a.record_id)) throw new Error("Give area, or record_type and record_id.");
      return { result: await pinsForRecord(s(a.record_type) as PinRecordType, s(a.record_id)) };
    },
  },
  {
    name: "cmi_pin",
    title: "Pin a project to another board",
    description: "Also show a project on another board (pipeline, precon or jobs) without moving it. record_type is where it lives (deal, precon, job). Pinned cards aren't counted in that board's totals.",
    risk: "write",
    available: anyStaff,
    inputSchema: () => obj({ record_type: { type: "string", enum: ["deal", "precon", "job"] }, record_id: str("Record id"), show_in: { type: "string", enum: AREAS }, note: str("Why (optional)") }, ["record_type", "record_id", "show_in"]),
    run: async (a, c) => {
      await pinRecord(s(a.record_type) as PinRecordType, s(a.record_id), s(a.show_in) as Area, c.ctx.id, s(a.note) || null);
      return { result: { pinned: true, show_in: AREA_LABEL[s(a.show_in) as Area] }, entity: "project_pin", recordId: s(a.record_id) };
    },
  },
  {
    name: "cmi_unpin",
    title: "Unpin a project",
    description: "Remove a pin (pin id from cmi_pins).",
    risk: "write",
    available: anyStaff,
    inputSchema: () => obj({ pin_id: str("Pin id") }, ["pin_id"]),
    run: async (a) => { await unpin(s(a.pin_id)); return { result: { unpinned: true }, entity: "project_pin", recordId: s(a.pin_id) }; },
  },
];

// ─── Jobs: create properly ───────────────────────────────────────────────────

const jobCreateTools: McpTool[] = [
  {
    name: "cmi_job_create",
    title: "Create a job",
    description: `Create a job with its proper YY_### number. Give job_name, optional status (${ALL_JOB_STATUSES.join(", ")}), address fields, contract_price (admins), projected dates, project_manager, superintendent. Or give template_id (cmi_job_templates) to copy a template's settings and schedule shape. To promote a Pre-Con record use cmi_job_from_precon.`,
    risk: "write",
    available: jobWrite,
    inputSchema: () => obj({
      job_name: str("Job name"), template_id: str("Template job id (optional)"), status: { type: "string", enum: ALL_JOB_STATUSES },
      street_address: str("Street"), city: str("City"), state: str("State"), zip_code: str("ZIP"),
      projected_start_date: str("YYYY-MM-DD"), projected_completion_date: str("YYYY-MM-DD"), contract_price: { type: "number" },
      project_manager: str("PM name"), superintendent: str("Superintendent name"), contact_id: str("Client contact id (template path)"),
    }, ["job_name"]),
    run: async (a, c) => {
      if (!s(a.job_name)) throw new Error("Give the job a name.");
      if (a.contract_price != null && !c.ctx.isAdmin) throw new Error("Only roles that see financials can set the contract price.");
      if (s(a.template_id)) {
        const job = await createJobFromTemplate(s(a.template_id), { job_name: s(a.job_name), projected_start_date: s(a.projected_start_date) || null, contact_id: s(a.contact_id) || null, ...(s(a.status) ? { status: s(a.status) as never } : {}) }, actorOf(c));
        return { result: { created: job }, entity: "job", recordId: job.id, before: null, after: job };
      }
      const draft: Json = { job_name: s(a.job_name) };
      for (const k of ["status", "street_address", "city", "state", "zip_code", "projected_start_date", "projected_completion_date", "project_manager", "superintendent"]) if (s(a[k])) draft[k] = s(a[k]);
      if (typeof a.contract_price === "number") draft.contract_price = a.contract_price;
      const job = await createJob(draft as never, actorOf(c));
      return { result: { created: job }, entity: "job", recordId: job.id, before: null, after: job };
    },
  },
  {
    name: "cmi_job_templates",
    title: "Job templates",
    description: "The job templates you can create a job from (cmi_job_create with template_id).",
    risk: "read",
    available: jobWrite,
    inputSchema: () => obj(),
    run: async () => ({ result: { templates: (await loadTemplates()).map((t) => ({ id: t.id, name: t.job_name })) } }),
  },
  {
    name: "cmi_job_from_precon",
    title: "Move a Pre-Con project to Jobs",
    description: "Make a Pre-Con record a Job (or bring back the Job it had), so the project leaves Pre-Con and lives in Jobs. Copies name, address and value, carries the number, adds every client contact from the deal, and moves its schedules to the Job.",
    risk: "write",
    available: jobWrite,
    inputSchema: () => obj({ opportunity_id: str("Pre-Con record id") }, ["opportunity_id"]),
    run: async (a, c) => {
      const job = await convertOpportunityToJob(s(a.opportunity_id), {}, actorOf(c));
      return { result: { job: { id: job.id, job_number: job.job_number, job_name: job.job_name, status: job.status } }, entity: "job", recordId: job.id, after: job };
    },
  },
];

// ─── Deals: contacts, checklist, rename, duplicate, unarchive, add to Pipeline ─

const dealTools: McpTool[] = [
  {
    name: "cmi_deal_contacts",
    title: "Deal contacts",
    description: "The people on a deal (primary first), with their role on it.",
    risk: "read",
    available: anyStaff,
    inputSchema: () => obj({ deal_id: str("Deal id") }, ["deal_id"]),
    run: async (a) => ({ result: { contacts: await listDealContacts(s(a.deal_id)) } }),
  },
  {
    name: "cmi_deal_contact_save",
    title: "Add or update a person on a deal",
    description: "Add someone to a deal (contact_id of an existing Contact, or first_name / last_name / email / phone / company; an existing Contact with the same email or name is reused), or update one (link_id from cmi_deal_contacts). role: Homeowner, Designer, Architect, General Contractor, Referral Partner, Property Manager, Realtor, Other. is_primary makes them the deal's primary.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ deal_id: str("Deal id"), link_id: str("Existing link id (update)"), contact_id: str("Existing contact id"), first_name: str("First"), last_name: str("Last"), email: str("Email"), phone: str("Phone"), company: str("Company"), role: str("Role on the deal"), is_primary: bool("Primary contact") }, ["deal_id"]),
    run: async (a) => {
      const input: Json = {};
      for (const k of ["contact_id", "first_name", "last_name", "email", "phone", "company", "role"]) if (s(a[k])) input[k] = s(a[k]);
      if (typeof a.is_primary === "boolean") input.is_primary = a.is_primary;
      const rows = s(a.link_id) ? await updateDealContact(s(a.deal_id), s(a.link_id), input as never) : await addDealContact(s(a.deal_id), input as never);
      return { result: { contacts: rows }, entity: "deal", recordId: s(a.deal_id), after: rows };
    },
  },
  {
    name: "cmi_deal_contact_remove",
    title: "Take a person off a deal",
    description: "Remove someone from a deal (link_id from cmi_deal_contacts). Their Contact record stays.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ deal_id: str("Deal id"), link_id: str("Link id") }, ["deal_id", "link_id"]),
    run: async (a) => {
      const rows = await removeDealContact(s(a.deal_id), s(a.link_id));
      return { result: { contacts: rows }, entity: "deal", recordId: s(a.deal_id), after: rows };
    },
  },
  {
    name: "cmi_deal_checklist",
    title: "Deal checklist",
    description: "Read a deal's checklist (standard items and its own), or change it: action check (item_key or item_id, done), add (label, required), rename (item_id, label) or delete (item_id, one of its own items).",
    risk: "write",
    available: anyStaff,
    inputSchema: () => obj({
      deal_id: str("Deal id"), action: { type: "string", enum: ["read", "check", "add", "rename", "delete"] },
      item_key: str("Standard item key (check)"), item_id: str("Own item id"), label: str("Label"), done: bool("Done"), required: bool("Required"),
    }, ["deal_id"]),
    run: async (a, c) => {
      const dealId = s(a.deal_id), act = s(a.action) || "read";
      if (act !== "read" && !dealWrite(c)) throw new Error(`Your role (${c.ctx.role}) can't change deals.`);
      if (act === "check") {
        if (s(a.item_key)) await setChecklistItem(dealId, s(a.item_key), a.done !== false, actorOf(c));
        else if (s(a.item_id)) await updateChecklistItem(s(a.item_id), { done: a.done !== false }, actorOf(c));
        else throw new Error("Give item_key or item_id.");
      } else if (act === "add") {
        if (!s(a.label)) throw new Error("Give the item a label.");
        await createChecklistItem(dealId, { label: s(a.label), required: a.required === true }, actorOf(c));
      } else if (act === "rename") {
        await updateChecklistItem(s(a.item_id), { label: s(a.label) }, actorOf(c));
      } else if (act === "delete") {
        await deleteChecklistItem(s(a.item_id));
      }
      const [progress, items] = await Promise.all([loadChecklistProgress(dealId), loadChecklistItems(dealId)]);
      return { result: { standard: progress, own_items: items }, ...(act !== "read" ? { entity: "deal", recordId: dealId } : {}) };
    },
  },
  {
    name: "cmi_deal_rename",
    title: "Rename or renumber a deal",
    description: "Change a deal's pipeline number (YY_###) and name together; its Pre-Con record follows.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ deal_id: str("Deal id"), job_number: str("YY_###"), name: str("Name") }, ["deal_id", "job_number", "name"]),
    run: async (a, c) => {
      const r = await renameDeal(s(a.deal_id), { job_number: s(a.job_number), name: s(a.name) }, actorOf(c));
      return { result: r, entity: "deal", recordId: s(a.deal_id), after: r.deal };
    },
  },
  {
    name: "cmi_deal_duplicate",
    title: "Duplicate a deal",
    description: "Copy a deal as a new one (new number, not linked to any Pre-Con record).",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ deal_id: str("Deal id") }, ["deal_id"]),
    run: async (a, c) => { const d = await duplicateDeal(s(a.deal_id), actorOf(c)); return { result: { deal: d }, entity: "deal", recordId: d.id, after: d }; },
  },
  {
    name: "cmi_deal_unarchive",
    title: "Restore an archived deal",
    description: "Bring an archived deal back onto the Pipeline.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ deal_id: str("Deal id") }, ["deal_id"]),
    run: async (a, c) => { const d = await unarchiveDeal(s(a.deal_id), actorOf(c)); return { result: { deal: d }, entity: "deal", recordId: d.id, after: d }; },
  },
  {
    name: "cmi_add_to_pipeline",
    title: "Add a contact, quote or form submission to the Pipeline",
    description: "Start a deal from an existing Contact (contact_id), Quote / Lead (quote_id) or website form submission (submission_id). If one already exists for it, that deal is returned. Optional title, estimated_value, owner (staff id).",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ contact_id: str("Contact id"), quote_id: str("Quote id"), submission_id: str("Form submission id"), title: str("Deal title"), estimated_value: { type: "number" }, owner_id: str("Owner staff id") }),
    run: async (a, c) => {
      const o: Json = {};
      if (s(a.title)) o.title = s(a.title);
      if (typeof a.estimated_value === "number") o.estimated_value = a.estimated_value;
      if (s(a.owner_id)) o.owner_id = s(a.owner_id);
      const r = s(a.contact_id) ? await addContactToPipeline(s(a.contact_id), o as never, actorOf(c))
        : s(a.quote_id) ? await addQuoteToPipeline(s(a.quote_id), o as never, actorOf(c))
        : s(a.submission_id) ? await addSubmissionToPipeline(s(a.submission_id), o as never, actorOf(c))
        : (() => { throw new Error("Give contact_id, quote_id or submission_id."); })();
      return { result: r as unknown as Json, entity: "deal" };
    },
  },
  {
    name: "cmi_submission_convert",
    title: "Convert a website form submission",
    description: "Turn a contact-form submission into a Contact (to: contact), a Quote / Lead (to: lead) or a Pipeline deal (to: deal). Reuses a matching contact.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ submission_id: str("Submission id"), to: { type: "string", enum: ["contact", "lead", "deal"] } }, ["submission_id", "to"]),
    run: async (a, c) => {
      const id = s(a.submission_id);
      const r = a.to === "contact" ? await convertSubmissionToContact(id) : a.to === "lead" ? await convertSubmissionToLead(id) : await convertSubmissionToDeal(id, actorOf(c));
      return { result: r as unknown as Json, entity: "contact_submission", recordId: id };
    },
  },
  {
    name: "cmi_quote_create",
    title: "Create a quote request / lead",
    description: "Add a quote request (lead): name, email, phone, project_type, location, budget_range, timeline, description, estimated_value, source. Use cmi_add_to_pipeline to start a deal from it.",
    risk: "write",
    available: dealWrite,
    inputSchema: () => obj({ name: str("Name"), email: str("Email"), phone: str("Phone"), project_type: str("Project type"), location: str("Project location / address"), budget_range: str("Budget range"), timeline: str("Timeline"), description: str("Details"), estimated_value: { type: "number" }, source: str("Where it came from") }, ["name"]),
    run: async (a) => {
      const draft: Json = { status: "New", contact_id: null, sq_ft: null, services: null };
      for (const k of ["name", "email", "phone", "project_type", "location", "budget_range", "timeline", "description", "source"]) draft[k] = s(a[k]) || null;
      draft.name = s(a.name);
      draft.estimated_value = typeof a.estimated_value === "number" ? a.estimated_value : null;
      const q = await createQuote(draft as never);
      return { result: { quote: q }, entity: "quote", recordId: (q as { id: string }).id, after: q };
    },
  },
];

export function handoffTools(): McpTool[] {
  return [...moveTools, ...jobCreateTools, ...dealTools];
}
