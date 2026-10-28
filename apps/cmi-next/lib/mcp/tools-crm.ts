// Phase B MCP tools: contacts, companies, deals, Pre-Con, jobs (notes, daily
// logs, action items, client updates), commitments, knowledge and meetings.
// Thin wrappers over the dashboard's own lib/* functions, with the MCP gates
// on top: the entity's write roles, the money gate (only admins write money
// fields), before/after in the audit log, and high-risk steps (merge,
// archive, close-won, client-visible posts, approvals) behind cmi_confirm.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEntity } from "@/lib/agent/entities";
import { canWrite, createRecord, getRecord, updateRecord } from "@/lib/agent/registry";
import { createContact, updateContact } from "@/lib/contacts/data";
import { mergeContacts } from "@/lib/contacts/merge";
import { fullName as dupName } from "@/lib/contacts/duplicates";
import { getCompany, updateCompany, type Company } from "@/lib/companies/data";
import {
  changeStage, createDeal, createDealTask, getDeal, loadActivities, loadDealTasks, loadDeals, loadStageHistory as loadDealStageHistory,
  logActivity, updateDeal, updateDealTask,
} from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";
import { DEAL_STAGE_META, DEAL_STAGES, isDealStage } from "@/lib/deals/stages";
import type { ActivityType, DealDraft } from "@/lib/deals/types";
import { getOpportunity, transitionStage } from "@/lib/pipeline/data";
import { ALL_STAGES, transitionRequiresAdmin } from "@/lib/pipeline/stages";
import type { PipelineStage } from "@/lib/pipeline/types";
import { createJobNote } from "@/lib/job-notes/data";
import { createDailyLog, updateDailyLog } from "@/lib/daily-logs/data";
import { createActionItem, updateActionItem } from "@/lib/action-items/data";
import { createJobUpdate } from "@/lib/job-updates/data";
import { loadMeeting, loadMeetings, saveMeeting, updateMeetingFields } from "@/lib/meetings/data";
import { MEETING_TYPES } from "@/lib/meetings/types";
import {
  createCommitment, dismissCommitment, getCommitment, listCommitments, reopenCommitment, resolveCommitment, updateCommitment,
  COMMITMENT_SOURCES, WAITING_ON,
} from "@/lib/commitments/data";
import { canUsePrequal } from "@/lib/prequal/access";
import type { McpCaller } from "./auth";
import { entityAllowed, moneyKeysIn } from "./policy";
import { canTrash, recordLabel } from "./safety";
import { trashRecord } from "./trash";
import type { McpTool, ToolOutput } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const date = (description: string) => ({ type: "string", description: `${description} (YYYY-MM-DD)` });
const enumOf = (values: readonly string[], description: string) => ({ type: "string", enum: [...values], description });
const fields = (description: string) => ({ type: "object", description, additionalProperties: true });
const lim = (dflt: number) => ({ type: "integer", minimum: 1, maximum: 100, description: `Max rows (default ${dflt})` });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const actorOf = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName, email: c.ctx.email });
const clampN = (v: unknown, d: number, max = 100) => Math.min(Math.max(Number(v) || d, 1), max);
const sb = () => getSupabaseAdmin();

/** The registry entity's write roles, plus "is it visible to you at all". */
function gateEntity(c: McpCaller, key: string) {
  const e = getEntity(key);
  if (!e || !entityAllowed(key, c.ctx)) throw new Error(`"${key}" isn't available to you through Claude.`);
  if (!canWrite(e, c.ctx)) throw new Error(`Your role (${c.ctx.role}) can't change ${e.plural}.`);
  return e;
}

/** Only roles that can read financials may set money fields through AI. */
function gateMoney(c: McpCaller, data: Json | null | undefined) {
  if (c.ctx.isAdmin) return;
  const keys = moneyKeysIn(data);
  if (keys.length) throw new Error(`Only roles that can see financials can change money fields (${keys.join(", ")}). Leave them out and try again.`);
}

function gateDeals(c: McpCaller) {
  if (!canWriteDeals(c.ctx.role)) throw new Error(`Your role (${c.ctx.role}) can't change deals.`);
}

const admin = (c: McpCaller) => canTrash(c.ctx.role);

/** "26_014 Smith Remodel", without repeating the name when the number already has it. */
const jobLabel = (j: { job_number: string | null; job_name: string | null }) =>
  j.job_number && j.job_name && j.job_number.includes(j.job_name) ? j.job_number : [j.job_number, j.job_name].filter(Boolean).join(" ");

/** A job by id or exact job number; a name only when exactly one job matches (writes must not guess). */
async function resolveJobId(ref: unknown): Promise<{ id: string; label: string }> {
  const r = s(ref);
  if (!r) throw new Error("Which job? Give its id, job number (e.g. 26_014) or exact name.");
  const pick = (j: { id: string; job_number: string | null; job_name: string | null }) => ({ id: j.id, label: jobLabel(j) });
  if (UUID_RE.test(r)) {
    const { data } = await sb().from("jobs").select("id, job_number, job_name").eq("id", r).maybeSingle();
    if (data) return pick(data);
  }
  const { data: byNum } = await sb().from("jobs").select("id, job_number, job_name").eq("job_number", r).maybeSingle();
  if (byNum) return pick(byNum);
  const { data: byName } = await sb().from("jobs").select("id, job_number, job_name").ilike("job_name", `%${r.replace(/[%_,()]/g, " ")}%`).limit(5);
  if (byName?.length === 1) return pick(byName[0]);
  if (byName && byName.length > 1) throw new Error(`"${r}" matches several jobs: ${byName.map(jobLabel).join("; ")}. Use the job number.`);
  throw new Error(`No job matches "${r}".`);
}

async function staffIdFor(ref: unknown): Promise<string | null> {
  const r = s(ref);
  if (!r) return null;
  if (UUID_RE.test(r)) return r;
  const { data } = await sb().from("staff_users").select("id, email, display_name").in("status", ["active", "invited"])
    .or(`email.ilike.${r.replace(/[,()]/g, " ")},display_name.ilike.%${r.replace(/[%_,()]/g, " ")}%`).limit(2);
  if (data?.length === 1) return data[0].id as string;
  throw new Error(data?.length ? `"${r}" matches more than one staff member. Use their email.` : `No staff member matches "${r}".`);
}

// ─── Contacts & companies ───────────────────────────────────────────────────

const CONTACT_FIELDS = "first_name, last_name, email, phone, company, type (Client, Lead, Prospect, Customer, Vendor, Sub Contractor, Designer, Other), status, address, city, state, zip, notes, tags, source, lead_owner";

const contactTools: McpTool[] = [
  {
    name: "cmi_contacts_search",
    title: "Find contacts",
    description: "Search CMI contacts by name, email, phone or company. Returns id, name, email, phone, company, type and status. Archived contacts are left out unless include_archived is true.",
    risk: "read",
    inputSchema: () => obj({ query: str("Name, email, phone or company"), type: str("Contact type, e.g. Client, Lead, Vendor"), include_archived: { type: "boolean" }, limit: lim(20) }, ["query"]),
    run: async (a) => {
      const term = s(a.query).replace(/[%_,()]/g, " ");
      const words = term.split(/\s+/).filter(Boolean);
      let q = sb().from("contacts").select("id, first_name, last_name, email, phone, company, type, status, last_activity").limit(clampN(a.limit, 20));
      for (const w of words) q = q.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,email.ilike.%${w}%,phone.ilike.%${w}%,company.ilike.%${w}%`);
      if (s(a.type)) q = q.eq("type", s(a.type));
      if (a.include_archived !== true) q = q.neq("status", "archived");
      const { data, error } = await q.order("last_activity", { ascending: false, nullsFirst: false });
      if (error) return { result: { error: error.message } };
      return { result: { contacts: data ?? [] } };
    },
  },
  {
    name: "cmi_contacts_get",
    title: "Contact with history",
    description: "One contact in full, with their recent messages (email/SMS/calls), deals, meetings, activity and open commitments.",
    risk: "read",
    inputSchema: () => obj({ id: str("Contact id") }, ["id"]),
    run: async (a) => {
      const id = s(a.id);
      const { data: contact } = await sb().from("contacts").select("*").eq("id", id).maybeSingle();
      if (!contact) return { result: { error: "No contact with that id." } };
      const [messages, deals, meetings, activities, commitments] = await Promise.all([
        sb().from("messages").select("id, direction, channel, subject, body, status, sent_at, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(15),
        sb().from("deals").select("id, title, stage, owner_id, next_action, next_action_due, archived_at").eq("contact_id", id),
        sb().from("meetings").select("id, title, meeting_date, meeting_type, summary").eq("contact_id", id).order("meeting_date", { ascending: false }).limit(10),
        loadActivities({ contactId: id }).catch(() => []),
        listCommitments({ contactId: id }).catch(() => []),
      ]);
      const trim = (t: unknown) => (typeof t === "string" && t.length > 600 ? `${t.slice(0, 600)}…` : t);
      return { result: {
        contact,
        messages: (messages.data ?? []).map((m) => ({ ...m, body: trim(m.body) })),
        deals: deals.data ?? [],
        meetings: (meetings.data ?? []).map((m) => ({ ...m, summary: trim(m.summary) })),
        activity: activities.slice(0, 15).map((x) => ({ ...x, body: trim(x.body) })),
        open_commitments: commitments,
      } };
    },
  },
  {
    name: "cmi_contacts_create",
    title: "Add a contact",
    description: `Create a contact. Fields: ${CONTACT_FIELDS}. first_name is required. If someone with the same email, or the same name and phone, already exists, nothing is created and the existing contact comes back instead: use it, or call again with confirmed_different=true only if the person says it's someone else.`,
    risk: "write",
    inputSchema: () => obj({ contact: fields("The contact's fields"), confirmed_different: { type: "boolean", description: "The person confirmed a 'likely' match is a different person" } }, ["contact"]),
    run: async (a, c) => {
      gateEntity(c, "contact");
      const draft = { ...(a.contact as Json) } as Json;
      if (!s(draft.first_name)) return { result: { error: "first_name is required." } };
      try {
        const created = await createContact(draft as never, { confirmed: a.confirmed_different === true });
        return { result: { created: true, contact: created }, entity: "contact", recordId: created.id, before: null, after: created };
      } catch (err) {
        const match = (err as { existing?: Json }).existing;
        if (match) {
          return { result: { created: false, duplicate: true, message: (err as Error).message,
            existing: { id: match.id, name: dupName(match as never), email: match.email, phone: match.phone, company: match.company, reason: match.reason } } };
        }
        throw err;
      }
    },
  },
  {
    name: "cmi_contacts_update",
    title: "Update a contact",
    description: `Change a contact's fields. Fields: ${CONTACT_FIELDS}. Only send the fields that change. To archive a contact use cmi_delete_record (admins).`,
    risk: "write",
    inputSchema: () => obj({ id: str("Contact id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      gateEntity(c, "contact");
      const id = s(a.id);
      const changes = { ...(a.changes as Json) };
      if (changes.status === "archived") return { result: { error: "Archiving goes through cmi_delete_record (Super Admin / Admin) so it can be restored." } };
      const { data: before } = await sb().from("contacts").select("*").eq("id", id).maybeSingle();
      if (!before) return { result: { error: "No contact with that id." } };
      const after = await updateContact(id, changes as never);
      return { result: { updated: true, contact: after }, entity: "contact", recordId: id, before, after };
    },
  },
  {
    name: "cmi_contacts_merge",
    title: "Merge duplicate contacts",
    description: "Merge one or more duplicate contacts into the one to keep (Super Admin / Admin). Their messages, deals, meetings and other links move to the kept contact. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: (c) => admin(c),
    inputSchema: () => obj({ keep_id: str("Contact to keep"), merge_ids: { type: "array", items: { type: "string" }, description: "Duplicates to merge into it" } }, ["keep_id", "merge_ids"]),
    preview: async (a) => {
      const keep = s(a.keep_id);
      const losers = (Array.isArray(a.merge_ids) ? a.merge_ids : []).map(String).filter((x) => x && x !== keep);
      if (!losers.length) throw new Error("Name at least one duplicate to merge in.");
      const { data } = await sb().from("contacts").select("id, first_name, last_name, email, phone, company").in("id", [keep, ...losers]);
      const byId = new Map((data ?? []).map((r) => [r.id as string, r]));
      if (!byId.has(keep)) throw new Error("The contact to keep doesn't exist.");
      const missing = losers.filter((x) => !byId.has(x));
      if (missing.length) throw new Error(`Not found: ${missing.join(", ")}.`);
      const label = (id: string) => { const r = byId.get(id)!; return `${[r.first_name, r.last_name].filter(Boolean).join(" ")} <${r.email ?? "no email"}>`; };
      return { summary: `Merge ${losers.map(label).join(", ")} into ${label(keep)}. The merged records are removed and their history moves to the kept contact.`,
        details: { keep: byId.get(keep), merge: losers.map((x) => byId.get(x)) }, entity: "contact", recordId: keep };
    },
    execute: async (a, c) => {
      const keep = s(a.keep_id);
      const losers = (Array.isArray(a.merge_ids) ? a.merge_ids : []).map(String);
      const { data: before } = await sb().from("contacts").select("*").in("id", [keep, ...losers]);
      const out = await mergeContacts(keep, losers, { actorId: c.ctx.id });
      return { result: { merged: true, kept: keep, moved: out.moved }, entity: "contact", recordId: keep, before, after: null };
    },
  },
  {
    name: "cmi_companies_search",
    title: "Find companies",
    description: "Search companies (trade partners, vendors, client companies) by name. Returns id, name, partner type, qualification status, trades and city.",
    risk: "read",
    inputSchema: () => obj({ query: str("Company name"), limit: lim(20) }, ["query"]),
    run: async (a) => {
      const { data } = await sb().from("companies").select("id, name, partner_type, qualification_status, trades, city, phone, email")
        .ilike("name", `%${s(a.query).replace(/[%_,()]/g, " ")}%`).is("archived_at", null).limit(clampN(a.limit, 20));
      return { result: { companies: data ?? [] } };
    },
  },
  {
    name: "cmi_companies_get",
    title: "Company profile",
    description: "One company's full profile with its contacts and compliance documents (status and expiry).",
    risk: "read",
    inputSchema: () => obj({ id: str("Company id") }, ["id"]),
    run: async (a) => {
      const company = await getCompany(s(a.id));
      if (!company) return { result: { error: "No company with that id." } };
      const [contacts, docs] = await Promise.all([
        sb().from("contacts").select("id, first_name, last_name, email, phone, company_roles").eq("company_id", company.id),
        sb().from("company_documents").select("id, doc_type, label, status, expires_on, ai_summary, ai_flags").eq("company_id", company.id),
      ]);
      return { result: { company, contacts: contacts.data ?? [], documents: docs.data ?? [] } };
    },
  },
  {
    name: "cmi_companies_update",
    title: "Update a company",
    description: "Change a company's profile fields (name, phone, email, address, trades, service_areas, partner_type, notes…). Qualification status changes go through the Trade Partners review, not here.",
    risk: "write",
    available: (c) => canUsePrequal(c.ctx.role),
    inputSchema: () => obj({ id: str("Company id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      const id = s(a.id);
      const changes = { ...(a.changes as Json) };
      for (const k of ["qualification_status", "approved_at", "approved_by", "archived_at", "id"]) delete changes[k];
      gateMoney(c, changes);
      const before = await getCompany(id);
      if (!before) return { result: { error: "No company with that id." } };
      const after = await updateCompany(id, changes as Partial<Company>, c.ctx.id);
      return { result: { updated: true, company: after }, entity: "company", recordId: id, before, after };
    },
  },
];

// ─── Deals, Pre-Con, pipeline review ────────────────────────────────────────

const DEAL_FIELDS = "title, contact_id, company_id, street_address, city, state, zip, source, referral_source, estimated_value (admins), target_start_date, expected_close_date, job_type, probability, owner_id, next_action, next_action_due, next_action_owner_id, notes, tags";
const OPEN_STAGES = DEAL_STAGES.filter((st) => DEAL_STAGE_META[st].open);

const dealTools: McpTool[] = [
  {
    name: "cmi_deal_get",
    title: "Deal in full",
    description: "One Pipeline deal with its tasks, activity timeline and stage history.",
    risk: "read",
    inputSchema: () => obj({ id: str("Deal id") }, ["id"]),
    run: async (a) => {
      const deal = await getDeal(s(a.id));
      if (!deal) return { result: { error: "No deal with that id." } };
      const [tasks, activity, history] = await Promise.all([
        loadDealTasks({ dealId: deal.id }), loadActivities({ dealId: deal.id }), loadDealStageHistory(deal.id),
      ]);
      return { result: { deal, tasks, activity: activity.slice(0, 25), stage_history: history } };
    },
  },
  {
    name: "cmi_deal_create",
    title: "Create a deal",
    description: `Start a new Pipeline deal (stage "New / Working"). Fields: ${DEAL_FIELDS}. title is required.`,
    risk: "write",
    inputSchema: () => obj({ deal: fields("The deal's fields") }, ["deal"]),
    run: async (a, c) => {
      gateDeals(c);
      const draft = { ...(a.deal as Json) } as Json;
      if (!s(draft.title)) return { result: { error: "title is required." } };
      gateMoney(c, draft);
      delete draft.stage;
      const deal = await createDeal({ ...(draft as DealDraft), owner_id: (draft.owner_id as string) ?? c.ctx.id }, actorOf(c));
      return { result: { created: true, deal }, entity: "deal", recordId: deal.id, before: null, after: deal };
    },
  },
  {
    name: "cmi_deal_update",
    title: "Update a deal",
    description: `Change a deal's fields. Fields: ${DEAL_FIELDS}. Use cmi_deal_move_stage to change the stage.`,
    risk: "write",
    inputSchema: () => obj({ id: str("Deal id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      gateDeals(c);
      const id = s(a.id);
      const changes = { ...(a.changes as Json) };
      if ("stage" in changes) return { result: { error: "Change the stage with cmi_deal_move_stage." } };
      for (const k of ["archived_at", "archived_by", "opportunity_id", "job_number", "id"]) delete changes[k];
      gateMoney(c, changes);
      const before = await getDeal(id);
      if (!before) return { result: { error: "No deal with that id." } };
      const after = await updateDeal(id, changes as Partial<DealDraft>, actorOf(c));
      return { result: { updated: true, deal: after }, entity: "deal", recordId: id, before, after };
    },
  },
  {
    name: "cmi_deal_move_stage",
    title: "Move a deal to a stage",
    description: `Move a deal to another stage: ${OPEN_STAGES.join(", ")} or lost_on_hold (needs lost_reason). Fields the new stage requires can be passed in changes. Moving to closed_won uses cmi_deal_close_won, because that starts Pre-Con.`,
    risk: "write",
    inputSchema: () => obj({
      id: str("Deal id"), stage: enumOf(DEAL_STAGES.filter((st) => st !== "closed_won"), "New stage"),
      changes: fields("Fields to set at the same time (e.g. lost_reason)"), note: str("Why (kept in stage history)"),
    }, ["id", "stage"]),
    run: async (a, c) => {
      gateDeals(c);
      const to = s(a.stage);
      if (to === "closed_won") return { result: { error: "Use cmi_deal_close_won to mark a deal won (it starts Pre-Con)." } };
      if (!isDealStage(to)) return { result: { error: `Unknown stage "${to}".` } };
      const changes = { ...((a.changes as Json) ?? {}) };
      gateMoney(c, changes);
      const before = await getDeal(s(a.id));
      if (!before) return { result: { error: "No deal with that id." } };
      try {
        const after = await changeStage(before.id, to, changes as Partial<DealDraft>, actorOf(c), s(a.note) || null);
        return { result: { moved: true, from: before.stage, to, deal: after }, entity: "deal", recordId: before.id, before, after };
      } catch (err) {
        const missing = (err as { missing?: string[] }).missing;
        return { result: { error: (err as Error).message, ...(missing?.length ? { missing_fields: missing } : {}) } };
      }
    },
  },
  {
    name: "cmi_deal_close_won",
    title: "Mark a deal won (starts Pre-Con)",
    description: "Move a deal to Closed Won. This creates its Pre-Con record and job number, so it previews first and runs with cmi_confirm.",
    risk: "high",
    inputSchema: () => obj({ id: str("Deal id"), note: str("Note for stage history") }, ["id"]),
    available: (c) => canWriteDeals(c.ctx.role),
    preview: async (a) => {
      const deal = await getDeal(s(a.id));
      if (!deal) throw new Error("No deal with that id.");
      if (deal.stage === "closed_won") throw new Error(`"${deal.title}" is already Closed Won.`);
      return { summary: `Mark "${deal.title}" as Closed Won. This creates its Pre-Con record${deal.opportunity_id ? "" : " and assigns a job number"}.`,
        details: { deal: deal.title, from: deal.stage }, entity: "deal", recordId: deal.id };
    },
    execute: async (a, c) => {
      const before = await getDeal(s(a.id));
      if (!before) throw new Error("No deal with that id.");
      const after = await changeStage(before.id, "closed_won", {}, actorOf(c), s(a.note) || null);
      return { result: { won: true, deal: after, pre_con_id: after.opportunity_id, job_number: after.job_number }, entity: "deal", recordId: before.id, before, after };
    },
  },
  {
    name: "cmi_deal_archive",
    title: "Archive a deal",
    description: "Take a deal off the board (Super Admin / Admin). It's archived, not deleted, and can be restored with cmi_restore. Previews first; runs with cmi_confirm.",
    risk: "high",
    capGroup: "trash",
    available: (c) => admin(c),
    inputSchema: () => obj({ id: str("Deal id") }, ["id"]),
    preview: async (a) => {
      const deal = await getDeal(s(a.id));
      if (!deal) throw new Error("No deal with that id.");
      if (deal.archived_at) throw new Error(`"${deal.title}" is already archived.`);
      return { summary: `Archive the deal "${deal.title}" (${deal.stage}). It can be restored.`, entity: "deal", recordId: deal.id };
    },
    execute: async (a, c) => {
      const { trashId, label, before } = await trashRecord("deal", s(a.id), c.ctx, "mcp");
      return { result: { archived: true, label, trash_id: trashId }, entity: "deal", recordId: s(a.id), before, after: null };
    },
  },
  {
    name: "cmi_deal_task_create",
    title: "Add a deal task",
    description: "Add a next-step task to a deal (or a contact). Assign it with assigned_to (staff email or id); they're notified.",
    risk: "write",
    inputSchema: () => obj({ deal_id: str("Deal id"), contact_id: str("Contact id (if not on a deal)"), title: str("What needs doing"), description: str("Details"), assigned_to: str("Staff email or id (default you)"), due_at: str("When it's due (date or date-time)") }, ["title"]),
    run: async (a, c) => {
      gateDeals(c);
      if (!s(a.deal_id) && !s(a.contact_id)) return { result: { error: "Give a deal_id or contact_id." } };
      const task = await createDealTask({
        title: s(a.title), description: s(a.description) || null, deal_id: s(a.deal_id) || null, contact_id: s(a.contact_id) || null,
        assigned_to: (await staffIdFor(a.assigned_to)) ?? c.ctx.id, due_at: s(a.due_at) || null,
      }, actorOf(c));
      return { result: { created: true, task }, entity: "deal_task", recordId: task.id, before: null, after: task };
    },
  },
  {
    name: "cmi_deal_task_update",
    title: "Update or complete a deal task",
    description: "Change a deal task (title, description, assigned_to, due_at) or complete it (completed=true) / reopen it (completed=false).",
    risk: "write",
    inputSchema: () => obj({ id: str("Task id"), title: str("New title"), description: str("Details"), assigned_to: str("Staff email or id"), due_at: str("Due"), completed: { type: "boolean" } }, ["id"]),
    run: async (a, c) => {
      gateDeals(c);
      const id = s(a.id);
      const { data: before } = await sb().from("deal_tasks").select("*").eq("id", id).maybeSingle();
      if (!before) return { result: { error: "No task with that id." } };
      const patch: Json = {};
      if (s(a.title)) patch.title = s(a.title);
      if ("description" in a) patch.description = s(a.description) || null;
      if (s(a.assigned_to)) patch.assigned_to = await staffIdFor(a.assigned_to);
      if (s(a.due_at)) patch.due_at = s(a.due_at);
      if (typeof a.completed === "boolean") patch.completed_at = a.completed ? new Date().toISOString() : null;
      const after = await updateDealTask(id, patch as never, actorOf(c));
      return { result: { updated: true, task: after }, entity: "deal_task", recordId: id, before, after };
    },
  },
  {
    name: "cmi_deal_log_activity",
    title: "Log a call, meeting or note",
    description: "Add to a deal's (or contact's) activity timeline: a call, email, meeting, site visit or note, with a short summary. Optionally add the next-step task at the same time.",
    risk: "write",
    inputSchema: () => obj({
      deal_id: str("Deal id"), contact_id: str("Contact id"), job_id: str("Job id"),
      type: enumOf(["call", "sms", "email", "note", "meeting", "site_visit", "appointment"], "What happened"),
      summary: str("One line"), body: str("Details"), occurred_at: str("When (default now)"),
      next_task: str("Optional next step to add as a task"), next_task_due: str("Due date for the next step"),
    }, ["type", "summary"]),
    run: async (a, c) => {
      gateDeals(c);
      if (!s(a.deal_id) && !s(a.contact_id) && !s(a.job_id)) return { result: { error: "Give a deal_id, contact_id or job_id." } };
      const { activity, task } = await logActivity({
        type: s(a.type) as ActivityType, summary: s(a.summary), body: s(a.body) || null,
        deal_id: s(a.deal_id) || null, contact_id: s(a.contact_id) || null, job_id: s(a.job_id) || null,
        occurred_at: s(a.occurred_at) || undefined, metadata: { via: "mcp", client: c.clientKind },
      }, actorOf(c), s(a.next_task) ? { title: s(a.next_task), assigned_to: c.ctx.id, due_at: s(a.next_task_due) || null } : null);
      return { result: { logged: true, activity, next_task: task }, entity: "activity", recordId: activity.id, before: null, after: activity };
    },
  },
  {
    name: "cmi_precon_move_stage",
    title: "Move a Pre-Con opportunity",
    description: `Move a Pre-Con (pipeline_opportunities) record to another stage: ${ALL_STAGES.join(", ")}. Only allowed transitions work, and some need fields (passed in changes); the error lists what's missing. Closed → warranty is admin-only.`,
    risk: "write",
    inputSchema: () => obj({ id: str("Pre-Con opportunity id"), stage: enumOf(ALL_STAGES, "New stage"), changes: fields("Fields the new stage needs"), note: str("Why") }, ["id", "stage"]),
    run: async (a, c) => {
      gateEntity(c, "opportunity");
      const to = s(a.stage) as PipelineStage;
      const changes = { ...((a.changes as Json) ?? {}) };
      gateMoney(c, changes);
      const before = await getOpportunity(s(a.id));
      if (!before) return { result: { error: "No Pre-Con record with that id." } };
      if (transitionRequiresAdmin(before.stage as PipelineStage, to) && !admin(c)) return { result: { error: "Only an admin can make that move." } };
      try {
        const after = await transitionStage(before.id, to, changes as never, actorOf(c), s(a.note) || null);
        return { result: { moved: true, from: before.stage, to, opportunity: after }, entity: "opportunity", recordId: before.id, before, after };
      } catch (err) {
        const missing = (err as { missing?: string[] }).missing;
        return { result: { error: (err as Error).message, ...(missing?.length ? { missing_fields: missing } : {}) } };
      }
    },
  },
  {
    name: "cmi_pipeline_review",
    title: "Pipeline review",
    description: "The state of the sales pipeline: deals per stage, stale deals (no activity in stale_days, default 14), tasks due in the next 7 days or overdue, and deals won or lost in the last 30 days.",
    risk: "read",
    inputSchema: () => obj({ stale_days: { type: "integer", minimum: 1, maximum: 180 }, owner: str("Only this owner (staff email or id)") }),
    run: async (a) => {
      const owner = s(a.owner) ? await staffIdFor(a.owner) : null;
      const staleDays = clampN(a.stale_days, 14, 180);
      const deals = (await loadDeals()).filter((d) => !owner || d.owner_id === owner);
      const byStage = Object.fromEntries(DEAL_STAGES.map((st) => [st, deals.filter((d) => d.stage === st).length]));
      const cutoff = Date.now() - staleDays * 86_400_000;
      const stale = deals.filter((d) => DEAL_STAGE_META[d.stage]?.open)
        .filter((d) => new Date(d.last_activity_at ?? d.updated_at).getTime() < cutoff)
        .map((d) => ({ id: d.id, title: d.title, stage: d.stage, last_activity_at: d.last_activity_at, next_action: d.next_action }));
      const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const ids = new Set(deals.map((d) => d.id));
      const { data: tasks } = await sb().from("deal_tasks").select("id, title, deal_id, assigned_to, due_at").is("completed_at", null).lte("due_at", soon).order("due_at");
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: moves } = await sb().from("deal_stage_history").select("deal_id, to_stage, changed_at").in("to_stage", ["closed_won", "lost_on_hold"]).gte("changed_at", since);
      return { result: {
        deals_by_stage: byStage,
        stale: { days: staleDays, count: stale.length, deals: stale.slice(0, 30) },
        tasks_due: (tasks ?? []).filter((t) => !owner || ids.has(t.deal_id as string) || t.assigned_to === owner),
        last_30_days: {
          won: (moves ?? []).filter((m) => m.to_stage === "closed_won" && ids.has(m.deal_id as string)).length,
          lost_or_on_hold: (moves ?? []).filter((m) => m.to_stage === "lost_on_hold" && ids.has(m.deal_id as string)).length,
        },
      } };
    },
  },
];

// ─── Jobs: notes, daily logs, action items, client updates ──────────────────

const jobTools: McpTool[] = [
  {
    name: "cmi_job_note_create",
    title: "Add a job note",
    description: "Add an internal note to a job (staff only; clients never see notes). Job by id, job number or exact name.",
    risk: "write",
    inputSchema: () => obj({ job: str("Job id, number or name"), body: str("The note") }, ["job", "body"]),
    run: async (a, c) => {
      gateEntity(c, "job_note");
      const job = await resolveJobId(a.job);
      const note = await createJobNote(job.id, s(a.body), c.ctx);
      return { result: { created: true, job: job.label, note }, entity: "job_note", recordId: note.id, before: null, after: note };
    },
  },
  {
    name: "cmi_daily_log_create",
    title: "Write a daily log",
    description: "Create a daily log on a job in CMI's format: log_date, notes (work done), crew (names), hours_worked, visitors, delays. Weather is filled in automatically when left blank. visibility 'team' (default) or 'private'; client_visible shows it in the client portal.",
    risk: "write",
    inputSchema: () => obj({
      job: str("Job id, number or name"), log_date: date("Date of the work (default today)"), notes: str("Work done, materials, inspections"),
      crew: { type: "array", items: { type: "string" }, description: "Who was on site" }, hours_worked: { type: "number" },
      visitors: str("Visitors / inspectors"), delays: str("Delays or issues"), title: str("Short title (optional)"),
      visibility: enumOf(["team", "private"], "Who on staff sees it"), client_visible: { type: "boolean", description: "Show in the client portal" },
    }, ["job", "notes"]),
    run: async (a, c) => {
      gateEntity(c, "daily_log");
      const job = await resolveJobId(a.job);
      const log = await createDailyLog(job.id, {
        log_date: s(a.log_date) || new Date().toISOString().slice(0, 10), notes: s(a.notes), title: s(a.title) || null,
        crew: Array.isArray(a.crew) ? a.crew.map(String) : null, hours_worked: typeof a.hours_worked === "number" ? a.hours_worked : null,
        visitors: s(a.visitors) || null, delays: s(a.delays) || null,
        visibility: a.visibility === "private" ? "private" : "team", client_visible: a.client_visible === true, created_by_id: c.ctx.id,
      }, c.ctx.displayName);
      return { result: { created: true, job: job.label, daily_log: log }, entity: "daily_log", recordId: log.id, before: null, after: log };
    },
  },
  {
    name: "cmi_daily_log_update",
    title: "Edit a daily log",
    description: "Change a daily log's notes, crew, hours, visitors, delays, title, visibility or client_visible.",
    risk: "write",
    inputSchema: () => obj({ id: str("Daily log id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      gateEntity(c, "daily_log");
      const id = s(a.id);
      const { data: before } = await sb().from("daily_logs").select("*").eq("id", id).maybeSingle();
      if (!before) return { result: { error: "No daily log with that id." } };
      const allowed = ["log_date", "title", "notes", "weather", "temperature", "hours_worked", "crew", "visitors", "delays", "visibility", "client_visible", "include_in_brief"];
      const patch = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => allowed.includes(k)));
      const after = await updateDailyLog(id, patch as never);
      return { result: { updated: true, daily_log: after }, entity: "daily_log", recordId: id, before, after };
    },
  },
  {
    name: "cmi_action_item_create",
    title: "Add a client action item",
    description: "Add an action item on a job for the client to do (choose a selection, sign a change order…). These show in the client portal; assign to a client contact with assigned_contact_id.",
    risk: "write",
    inputSchema: () => obj({
      job: str("Job id, number or name"), title: str("What the client needs to do"), description: str("Details"),
      due_date: date("Due"), priority: enumOf(["low", "normal", "high", "urgent"], "Priority"), assigned_contact_id: str("Client contact id"),
    }, ["job", "title"]),
    run: async (a, c) => {
      gateEntity(c, "action_item");
      const job = await resolveJobId(a.job);
      const item = await createActionItem(job.id, {
        title: s(a.title), description: s(a.description) || null, due_date: s(a.due_date) || null,
        priority: (s(a.priority) || "normal") as never, assigned_contact_id: s(a.assigned_contact_id) || null,
      }, c.ctx.displayName);
      return { result: { created: true, job: job.label, action_item: item }, entity: "action_item", recordId: item.id, before: null, after: item };
    },
  },
  {
    name: "cmi_action_item_update",
    title: "Update or complete an action item",
    description: "Change an action item's title, description, due_date, priority, assigned_contact_id or status (open, in_progress, completed, dismissed).",
    risk: "write",
    inputSchema: () => obj({ id: str("Action item id"), changes: fields("Fields to change") }, ["id", "changes"]),
    run: async (a, c) => {
      gateEntity(c, "action_item");
      const id = s(a.id);
      const { data: before } = await sb().from("job_action_items").select("*").eq("id", id).maybeSingle();
      if (!before) return { result: { error: "No action item with that id." } };
      const allowed = ["title", "description", "due_date", "priority", "assigned_contact_id", "status"];
      const patch: Json = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => allowed.includes(k)));
      if (patch.status === "completed" && !before.completed_at) patch.completed_at = new Date().toISOString();
      if (patch.status && patch.status !== "completed") patch.completed_at = null;
      const after = await updateActionItem(id, patch as never);
      return { result: { updated: true, action_item: after }, entity: "action_item", recordId: id, before, after };
    },
  },
  {
    name: "cmi_job_update_post",
    title: "Post a client update",
    description: "Post an update to a job's client portal feed (the client sees it). Previews first; runs with cmi_confirm. For staff-only notes use cmi_job_note_create.",
    risk: "high",
    openWorld: true,
    inputSchema: () => obj({
      job: str("Job id, number or name"), title: str("Headline"), body: str("The update"),
      update_type: str("general, schedule, inspection, delay_notice, action_needed…"), client_action_required: { type: "boolean" },
    }, ["job", "title", "body"]),
    available: (c) => { const e = getEntity("job_update"); return !!e && canWrite(e, c.ctx); },
    preview: async (a) => {
      const job = await resolveJobId(a.job);
      return { summary: `Post "${s(a.title)}" to the client portal for ${job.label}. The client will see it.`,
        details: { job: job.label, title: s(a.title), body: s(a.body) }, entity: "job_update" };
    },
    execute: async (a, c) => {
      const job = await resolveJobId(a.job);
      const update = await createJobUpdate(job.id, {
        title: s(a.title), body: s(a.body), update_type: s(a.update_type) || "general", visibility: "client_visible",
        client_action_required: a.client_action_required === true,
      }, c.ctx.displayName);
      return { result: { posted: true, job: job.label, update }, entity: "job_update", recordId: update.id, before: null, after: update };
    },
  },
];

// ─── Commitments ────────────────────────────────────────────────────────────

const commitmentFields = {
  title: str("What was promised, short"), details: str("More detail"), owner: str("Who owns it (staff email or id; default you)"),
  waiting_on: enumOf(WAITING_ON, "Who we're waiting on, if anyone"), waiting_on_contact_id: str("Contact we're waiting on"), waiting_on_staff: str("Teammate we're waiting on (email or id)"),
  job: str("Job id, number or name"), deal_id: str("Deal id"), opportunity_id: str("Pre-Con id"), contact_id: str("Contact id"), company_id: str("Company id"),
  source: enumOf(COMMITMENT_SOURCES, "Where it came from"), source_link: str("Link to the email, meeting or message"),
  source_ref: str("Stable id of the source (e.g. gmail thread id, meeting id) so it isn't filed twice"), due_on: date("Due"),
};

async function commitmentInput(a: Json): Promise<Json> {
  const out: Json = {};
  for (const k of ["title", "details", "waiting_on", "waiting_on_contact_id", "deal_id", "opportunity_id", "contact_id", "company_id", "source", "source_link", "source_ref", "due_on"]) {
    if (k in a) out[k] = a[k];
  }
  if (s(a.owner)) out.owner_staff_id = await staffIdFor(a.owner);
  if (s(a.waiting_on_staff)) out.waiting_on_staff_id = await staffIdFor(a.waiting_on_staff);
  if (s(a.job)) out.job_id = (await resolveJobId(a.job)).id;
  return out;
}

/** You may change your own commitments; admins and company-wide people may change anyone's. */
async function gateCommitment(c: McpCaller, id: string) {
  const existing = await getCommitment(id);
  if (!existing) throw new Error("No commitment with that id.");
  if (existing.owner_staff_id !== c.ctx.id && existing.created_by !== c.ctx.id && !admin(c) && !c.companyWide) {
    throw new Error("That commitment belongs to someone else. Ask them, or an admin.");
  }
  return existing;
}

const commitmentTools: McpTool[] = [
  {
    name: "cmi_commitments_list",
    title: "Commitments (promises & follow-ups)",
    description: "Open commitments: yours by default. Filter by job, deal, contact, status (open, done, dismissed, all) or stale_days (overdue by that many days). Company-wide people can pass owner=anyone's email, or owner='all'. waiting_on_me=true lists what others are waiting on you for.",
    risk: "read",
    inputSchema: () => obj({ owner: str("Staff email/id, or 'all' (company-wide only)"), job: str("Job id, number or name"), deal_id: str("Deal id"), contact_id: str("Contact id"),
      status: enumOf(["open", "done", "dismissed", "all"], "Default open"), stale_days: { type: "integer", minimum: 0, maximum: 365 }, waiting_on_me: { type: "boolean" }, limit: lim(50) }),
    run: async (a, c) => {
      let ownerId: string | null = c.ctx.id;
      const wantsOthers = s(a.owner) && s(a.owner) !== c.ctx.email;
      if (wantsOthers) {
        if (!c.companyWide && !admin(c)) return { result: { error: "You can see your own commitments. Company-wide access (Settings → Claude) is needed for others'." } };
        ownerId = s(a.owner) === "all" ? null : await staffIdFor(a.owner);
      }
      if (s(a.job) || s(a.deal_id) || s(a.contact_id)) ownerId = wantsOthers ? ownerId : null;
      const rows = await listCommitments({
        ownerId: a.waiting_on_me === true ? null : ownerId, waitingOnStaffId: a.waiting_on_me === true ? c.ctx.id : null,
        jobId: s(a.job) ? (await resolveJobId(a.job)).id : null, dealId: s(a.deal_id) || null, contactId: s(a.contact_id) || null,
        status: s(a.status) || null, staleDays: typeof a.stale_days === "number" ? a.stale_days : null, limit: clampN(a.limit, 50, 200),
      });
      return { result: { count: rows.length, commitments: rows } };
    },
  },
  {
    name: "cmi_commitments_get",
    title: "One commitment",
    description: "A commitment in full, with its source link and resolution.",
    risk: "read",
    inputSchema: () => obj({ id: str("Commitment id") }, ["id"]),
    run: async (a) => ({ result: (await getCommitment(s(a.id))) ?? { error: "No commitment with that id." } }),
  },
  {
    name: "cmi_commitments_create",
    title: "Record a commitment",
    description: "Record a promise or follow-up (from an email, meeting, call, Slack or by hand) so it's tracked until done. Link it to a job/deal/contact and its source; pass source_ref so the same source can't create it twice. Only create commitments the person approved.",
    risk: "write",
    inputSchema: () => obj(commitmentFields, ["title"]),
    run: async (a, c) => {
      const { commitment, created } = await createCommitment(await commitmentInput(a), c.ctx, "mcp");
      return { result: { created, commitment, ...(created ? {} : { note: "Already recorded from this source." }) },
        entity: "commitment", recordId: commitment.id, before: null, after: created ? commitment : null };
    },
  },
  {
    name: "cmi_commitments_update",
    title: "Change a commitment",
    description: "Change a commitment's title, details, owner (reassign; they're notified), due date, waiting-on or links.",
    risk: "write",
    inputSchema: () => obj({ id: str("Commitment id"), ...commitmentFields }, ["id"]),
    run: async (a, c) => {
      await gateCommitment(c, s(a.id));
      const input = await commitmentInput(a);
      const { before, after } = await updateCommitment(s(a.id), input, c.ctx);
      return { result: { updated: true, commitment: after }, entity: "commitment", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_commitments_resolve",
    title: "Mark a commitment done",
    description: "Close a commitment as done. evidence is required: a short note or link showing it happened (e.g. 'sent revised bid 11/3', a Gmail link).",
    risk: "write",
    inputSchema: () => obj({ id: str("Commitment id"), evidence: str("Proof it's done") }, ["id", "evidence"]),
    run: async (a, c) => {
      await gateCommitment(c, s(a.id));
      const { before, after } = await resolveCommitment(s(a.id), s(a.evidence), c.ctx);
      return { result: { done: true, commitment: after }, entity: "commitment", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_commitments_dismiss",
    title: "Dismiss a commitment",
    description: "Close a commitment that no longer applies (with a reason). It stays on record and can be reopened with reopen=true.",
    risk: "write",
    inputSchema: () => obj({ id: str("Commitment id"), reason: str("Why it no longer applies"), reopen: { type: "boolean", description: "Reopen instead" } }, ["id"]),
    run: async (a, c) => {
      await gateCommitment(c, s(a.id));
      const { before, after } = a.reopen === true ? await reopenCommitment(s(a.id), c.ctx) : await dismissCommitment(s(a.id), s(a.reason) || null, c.ctx);
      return { result: { status: after.status, commitment: after }, entity: "commitment", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_commitments_suggest",
    title: "Source text for suggesting commitments",
    description: "Get the text of a meeting (transcript + summary) or pasted text, plus the commitments already open on the linked job/deal/contact, so you can suggest new ones. Suggest them to the person; create only the ones they approve, with source_ref set.",
    risk: "read",
    inputSchema: () => obj({ meeting_id: str("Recording Studio meeting id"), text: str("Or: pasted email/message text"), source_ref: str("Id of the pasted source, if any") }),
    run: async (a, c) => {
      if (s(a.meeting_id)) {
        const m = await meetingFor(s(a.meeting_id), c);
        const contactId = m.contact_id ?? null;
        const existing = await listCommitments({ contactId: contactId ?? undefined }).catch(() => []);
        const alreadyFromThis = await listCommitments({ status: "all" }).then((r) => r.filter((x) => x.source_ref === `meeting:${m.id}`)).catch(() => []);
        return { result: {
          source: { type: "meeting", source_ref: `meeting:${m.id}`, title: m.title, date: m.meeting_date, contact_id: contactId, related_records: m.related_records },
          summary: m.summary, transcript: clip(m.transcript, 20_000), action_items: m.action_items,
          already_recorded_from_this_meeting: alreadyFromThis, open_commitments_for_contact: existing,
          instructions: "Suggest commitments (who owes what, by when). Create only what the person approves, with source='meeting' and the source_ref above.",
        } };
      }
      if (s(a.text)) return { result: { source: { type: "text", source_ref: s(a.source_ref) || null }, text: clip(s(a.text), 20_000),
        instructions: "Suggest commitments from this text. Create only what the person approves." } };
      return { result: { error: "Give a meeting_id or text." } };
    },
  },
];

// ─── Knowledge base ─────────────────────────────────────────────────────────

const KNOWLEDGE_WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const knowledgeLevels = (c: McpCaller) => ["all", ...(c.ctx.isAdmin ? ["financial"] : []), ...(c.companyWide ? ["company"] : [])];

const knowledgeTools: McpTool[] = [
  {
    name: "cmi_knowledge_list",
    title: "Knowledge base documents",
    description: "List CMI knowledge documents (SOPs, templates, standards) you may read, with status (draft / approved). Only approved documents are used by cmi_search_knowledge.",
    risk: "read",
    inputSchema: () => obj({ category: str("Category"), status: enumOf(["approved", "draft", "all"], "Default all") }),
    run: async (a, c) => {
      let q = sb().from("bolt_training_docs").select("id, title, category, access_level, status, version, enabled, updated_at, created_by_name")
        .in("access_level", knowledgeLevels(c)).order("updated_at", { ascending: false }).limit(200);
      if (s(a.category)) q = q.ilike("category", s(a.category));
      if (s(a.status) && s(a.status) !== "all") q = q.eq("status", s(a.status));
      const { data, error } = await q;
      return { result: error ? { error: error.message } : { documents: data ?? [] } };
    },
  },
  {
    name: "cmi_knowledge_get",
    title: "Read a knowledge document",
    description: "One knowledge document in full (approved or draft).",
    risk: "read",
    inputSchema: () => obj({ id: str("Document id") }, ["id"]),
    run: async (a, c) => {
      const { data } = await sb().from("bolt_training_docs").select("id, title, category, access_level, status, version, content, updated_at, approved_at")
        .eq("id", s(a.id)).in("access_level", knowledgeLevels(c)).maybeSingle();
      return { result: data ?? { error: "No document with that id (or it's above your access level)." } };
    },
  },
  {
    name: "cmi_knowledge_create_draft",
    title: "Draft a knowledge document",
    description: "Write a new SOP, template or standard as a DRAFT. Drafts aren't used by anyone's AI until a Super Admin / Admin approves them (cmi_knowledge_approve or the dashboard).",
    risk: "write",
    available: (c) => KNOWLEDGE_WRITE_ROLES.includes(c.ctx.role),
    inputSchema: () => obj({ title: str("Title"), content: str("Full text (markdown is fine)"), category: str("e.g. SOP, Template, Standard, Role"),
      access_level: enumOf(["all", "financial", "company"], "Who may read it (default all)") }, ["title", "content"]),
    run: async (a, c) => {
      const level = s(a.access_level) || "all";
      if (!knowledgeLevels(c).includes(level)) return { result: { error: `You can't create documents at access level "${level}".` } };
      const { data, error } = await sb().from("bolt_training_docs").insert({
        title: s(a.title), content: s(a.content), category: s(a.category) || null, access_level: level, status: "draft", enabled: true,
        source_name: "Claude (MCP)", created_by: c.ctx.id, created_by_name: c.ctx.displayName, version: 1,
      }).select("id, title, status, category, access_level").single();
      if (error) return { result: { error: error.message } };
      return { result: { created: true, document: data, note: "Saved as a draft. An admin approves it before any AI uses it." }, entity: "knowledge_doc", recordId: data.id, before: null, after: data };
    },
  },
  {
    name: "cmi_knowledge_update_draft",
    title: "Edit a draft knowledge document",
    description: "Change a DRAFT document's title, content, category or access level. Approved documents are changed in the dashboard (AI Agents → Training).",
    risk: "write",
    available: (c) => KNOWLEDGE_WRITE_ROLES.includes(c.ctx.role),
    inputSchema: () => obj({ id: str("Document id"), title: str("Title"), content: str("Full text"), category: str("Category"), access_level: enumOf(["all", "financial", "company"], "Access level") }, ["id"]),
    run: async (a, c) => {
      const { data: before } = await sb().from("bolt_training_docs").select("*").eq("id", s(a.id)).maybeSingle();
      if (!before) return { result: { error: "No document with that id." } };
      if (before.status !== "draft") return { result: { error: "That document is approved. Change it in the dashboard (AI Agents → Training), or write a new draft." } };
      const patch: Json = { updated_at: new Date().toISOString() };
      for (const k of ["title", "content", "category"]) if (s(a[k])) patch[k] = s(a[k]);
      if (s(a.access_level)) {
        if (!knowledgeLevels(c).includes(s(a.access_level))) return { result: { error: "You can't set that access level." } };
        patch.access_level = s(a.access_level);
      }
      const { data: after, error } = await sb().from("bolt_training_docs").update(patch).eq("id", before.id).select("id, title, status, category, access_level, updated_at").single();
      if (error) return { result: { error: error.message } };
      const { search: _s, ...beforeLite } = before as Json;
      return { result: { updated: true, document: after }, entity: "knowledge_doc", recordId: before.id, before: beforeLite, after };
    },
  },
  {
    name: "cmi_knowledge_approve",
    title: "Approve a knowledge draft",
    description: "Make a draft the approved version every AI reads (Super Admin / Admin). Previews first; runs with cmi_confirm.",
    risk: "high",
    available: (c) => admin(c),
    inputSchema: () => obj({ id: str("Draft document id") }, ["id"]),
    preview: async (a) => {
      const { data } = await sb().from("bolt_training_docs").select("id, title, status, category, access_level, content").eq("id", s(a.id)).maybeSingle();
      if (!data) throw new Error("No document with that id.");
      if (data.status === "approved") throw new Error(`"${data.title}" is already approved.`);
      return { summary: `Approve "${data.title}" (${data.category ?? "uncategorized"}, readable by: ${data.access_level}). Every AI will use it from now on.`,
        details: { title: data.title, excerpt: clip(data.content, 800) }, entity: "knowledge_doc", recordId: data.id };
    },
    execute: async (a, c) => {
      const { data, error } = await sb().from("bolt_training_docs").update({ status: "approved", approved_by: c.ctx.id, approved_at: new Date().toISOString(), enabled: true })
        .eq("id", s(a.id)).select("id, title, status, approved_at").single();
      if (error) throw new Error(error.message);
      return { result: { approved: true, document: data }, entity: "knowledge_doc", recordId: data.id, before: { status: "draft" }, after: data };
    },
  },
  {
    name: "cmi_knowledge_archive",
    title: "Archive a knowledge document",
    description: "Remove a knowledge document (Super Admin / Admin). It goes to the trash and can be restored. Previews first; runs with cmi_confirm.",
    risk: "high",
    capGroup: "trash",
    available: (c) => admin(c),
    inputSchema: () => obj({ id: str("Document id") }, ["id"]),
    preview: async (a) => {
      const { data } = await sb().from("bolt_training_docs").select("id, title, status").eq("id", s(a.id)).maybeSingle();
      if (!data) throw new Error("No document with that id.");
      return { summary: `Move the knowledge document "${data.title}" (${data.status}) to the trash. AI stops using it; it can be restored.`, entity: "knowledge_doc", recordId: data.id };
    },
    execute: async (a, c) => {
      const { trashId, label, before } = await trashRecord("knowledge_doc", s(a.id), c.ctx, "mcp");
      const { search: _s, ...lite } = before;
      return { result: { archived: true, label, trash_id: trashId }, entity: "knowledge_doc", recordId: s(a.id), before: lite, after: null };
    },
  },
];

// ─── Meetings (Recording Studio) ────────────────────────────────────────────

const clip = (t: unknown, n: number) => (typeof t === "string" && t.length > n ? `${t.slice(0, n)}\n…(truncated)` : t ?? null);

/** Your own meetings; admins and company-wide people see all. */
async function meetingFor(id: string, c: McpCaller) {
  const m = await loadMeeting(id);
  if (!m) throw new Error("No meeting with that id.");
  if (!admin(c) && !c.companyWide && m.created_by !== c.ctx.id && m.staff_user_id !== c.ctx.id) throw new Error("That meeting belongs to someone else.");
  return m;
}

const meetingTools: McpTool[] = [
  {
    name: "cmi_list_meetings",
    title: "Meetings (Recording Studio)",
    description: "Recorded meetings and calls in CMI's Recording Studio: yours, or everyone's for admins and company-wide people. Filter by search (title), contact, or date range.",
    risk: "read",
    inputSchema: () => obj({ search: str("Title words"), contact_id: str("Contact id"), from: str("From date"), to: str("To date"), limit: lim(25) }),
    run: async (a, c) => {
      const all = admin(c) || c.companyWide;
      const rows = await loadMeetings({ all, staffId: c.ctx.id, filters: { search: s(a.search) || undefined, contact_id: s(a.contact_id) || undefined, from: s(a.from) || undefined, to: s(a.to) || undefined } });
      return { result: { meetings: rows.slice(0, clampN(a.limit, 25)).map((m) => ({ ...m, summary: clip(m.summary, 400) })) } };
    },
  },
  {
    name: "cmi_get_meeting",
    title: "One meeting",
    description: "A meeting's summary, action items, attendees, linked records and transcript (long transcripts are truncated).",
    risk: "read",
    inputSchema: () => obj({ id: str("Meeting id") }, ["id"]),
    run: async (a, c) => {
      const m = await meetingFor(s(a.id), c);
      return { result: { ...m, transcript: clip(m.transcript, 30_000) } };
    },
  },
  {
    name: "cmi_meeting_save_notes",
    title: "Save meeting notes",
    description: "File a meeting's notes into Recording Studio: title, date, summary, transcript, action items, contact and linked job/deal. When notes come from Plaud (or another recorder), pass external_source='plaud' and external_id = the recording's id: the same recording is never filed twice (the existing meeting comes back instead).",
    risk: "write",
    inputSchema: () => obj({
      title: str("Meeting title"), meeting_date: str("When (date-time)"), meeting_type: enumOf(MEETING_TYPES, "Kind of meeting (default project_notes)"),
      summary: str("Summary"), transcript: str("Transcript (optional)"), action_items: { type: "array", items: { type: "string" }, description: "Action items" },
      contact_id: str("Contact id"), job: str("Job id, number or name"), deal_id: str("Deal id"),
      external_source: str("e.g. plaud"), external_id: str("The recording's id in that system"),
    }, ["title", "summary"]),
    run: async (a, c) => {
      gateEntity(c, "meeting");
      const extSource = s(a.external_source) || null;
      const extId = s(a.external_id) || null;
      if (extId) {
        const { data: existing } = await sb().from("meetings").select("id, title, meeting_date").eq("external_source", extSource ?? "").eq("external_id", extId).maybeSingle();
        if (existing) return { result: { created: false, note: "This recording is already filed.", meeting: existing } };
      }
      const related: { type: string; id: string; label?: string }[] = [];
      if (s(a.job)) { const j = await resolveJobId(a.job); related.push({ type: "job", id: j.id, label: j.label }); }
      if (s(a.deal_id)) { const d = await getDeal(s(a.deal_id)); if (d) related.push({ type: "deal", id: d.id, label: d.title }); }
      const saved = await saveMeeting({
        title: s(a.title), meeting_date: s(a.meeting_date) || new Date().toISOString(), meeting_type: (MEETING_TYPES as readonly string[]).includes(s(a.meeting_type)) ? s(a.meeting_type) : "project_notes",
        status: "reviewed", summary: s(a.summary), transcript: s(a.transcript) || null,
        action_items: Array.isArray(a.action_items) ? a.action_items.map((t, i) => ({ id: `ai_${i + 1}`, text: String(t), done: false })) : [],
        contact_id: s(a.contact_id) || null, staff_user_id: c.ctx.id, related_records: related,
      } as never, c.ctx.id);
      if (extId || extSource) await updateMeetingFields(saved.id, { external_source: extSource, external_id: extId });
      return { result: { created: true, meeting: { id: saved.id, title: saved.title, meeting_date: saved.meeting_date } }, entity: "meeting", recordId: saved.id, before: null, after: { id: saved.id, title: saved.title } };
    },
  },
  {
    name: "cmi_meeting_link",
    title: "Link a meeting",
    description: "Link a meeting to a contact, job or deal so it shows on their record.",
    risk: "write",
    inputSchema: () => obj({ id: str("Meeting id"), contact_id: str("Contact id"), job: str("Job id, number or name"), deal_id: str("Deal id") }, ["id"]),
    run: async (a, c) => {
      gateEntity(c, "meeting");
      const m = await meetingFor(s(a.id), c);
      const related = [...(m.related_records ?? [])];
      const add = (r: { type: string; id: string; label?: string }) => { if (!related.some((x) => x.type === r.type && x.id === r.id)) related.push(r); };
      if (s(a.job)) { const j = await resolveJobId(a.job); add({ type: "job", id: j.id, label: j.label }); }
      if (s(a.deal_id)) { const d = await getDeal(s(a.deal_id)); if (!d) return { result: { error: "No deal with that id." } }; add({ type: "deal", id: d.id, label: d.title }); }
      const patch: Json = { related_records: related };
      if (s(a.contact_id)) patch.contact_id = s(a.contact_id);
      await updateMeetingFields(m.id, patch);
      return { result: { linked: true, contact_id: patch.contact_id ?? m.contact_id, related_records: related }, entity: "meeting", recordId: m.id,
        before: { contact_id: m.contact_id, related_records: m.related_records }, after: patch };
    },
  },
];

// ─── Generic create / update for simple record types ────────────────────────

const genericTools: McpTool[] = [
  {
    name: "cmi_create_record",
    title: "Create a CMI record",
    description: "Create a simple CMI record of one type (selection, product, booking, warranty request, blog post, project item…). Prefer the dedicated tools for contacts, deals, daily logs, notes, action items, meetings and commitments. Call cmi_describe_entity first for the fields.",
    risk: "write",
    inputSchema: () => obj({ entity: str("Record type (see cmi_list_entities)"), data: fields("Field values") }, ["entity", "data"]),
    run: async (a, c) => {
      const key = s(a.entity);
      gateEntity(c, key);
      const data = { ...((a.data as Json) ?? {}) };
      gateMoney(c, data);
      const out = await createRecord(key, data, c.ctx);
      if ("error" in out) return { result: out };
      const rec = (out.record ?? out) as Json;
      return { result: out, entity: key, recordId: (rec.id as string) ?? null, before: null, after: rec };
    },
  },
  {
    name: "cmi_update_record",
    title: "Update a CMI record",
    description: "Change fields on one CMI record by id. Only send the fields that change. Prefer the dedicated tools for contacts, deals, daily logs, action items and commitments. Deleting goes through cmi_delete_record.",
    risk: "write",
    inputSchema: () => obj({ entity: str("Record type"), id: str("Record id"), changes: fields("Fields to change") }, ["entity", "id", "changes"]),
    run: async (a, c) => {
      const key = s(a.entity);
      gateEntity(c, key);
      const changes = { ...((a.changes as Json) ?? {}) };
      gateMoney(c, changes);
      const prior = await getRecord(key, s(a.id));
      if ("error" in prior) return { result: prior };
      const out = await updateRecord(key, s(a.id), changes, c.ctx);
      if ("error" in out) return { result: out };
      return { result: out, entity: key, recordId: s(a.id), before: prior.record, after: out.record ?? null };
    },
  },
];

export function crmTools(): McpTool[] {
  return [...genericTools, ...contactTools, ...dealTools, ...jobTools, ...commitmentTools, ...knowledgeTools, ...meetingTools];
}

/** Readable name for an audit/preview. */
export const labelFor = (row: Json | null, fallback: string) => recordLabel(row, fallback);
export type { ToolOutput };
