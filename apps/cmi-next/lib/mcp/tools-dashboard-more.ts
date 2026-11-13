// The rest of the dashboard for Claude: interviews, canvas briefs, business card
// leads, reporting edits, punch list edits, trade partner follow-ups and company
// merges, Cloud folders, prints, invoices (create and send), the client message
// thread, job notes, contact duplicates, commitments reopen, the overview and
// client engagement snapshots, feature flags and the sidebar.
//
// Deliberately left out: Settings → Claude (AI access grants and caps, so an AI
// can't widen its own access), user invites and roles, credentials, and purely
// personal screen state (column layouts, Gantt colours).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  listInterviews, getInterview, createInterview, saveAnswers, completeInterview, reopenInterview, addFollowup, setFollowupDone, listFollowups, listTemplates as listInterviewTemplates,
} from "@/lib/interviews/data";
import { canUseInterviews } from "@/lib/interviews/access";
import { listCanvases, getCanvasWithScenes, updateCanvas, listComments as listCanvasComments, addComment as addCanvasComment } from "@/lib/canvas/data";
import { canvasEnabled } from "@/lib/canvas/actor";
import type { CanvasActor } from "@/lib/canvas/actor";
import { loadCardsForViewer, loadLeads, updateLeadStatus, loadCardAnalytics } from "@/lib/business-cards/data";
import { addSection, addItem, moveItem, deleteItem as deleteReportItem, updateReport } from "@/lib/reporting/data";
import { canEditReports, REPORTING_FLAG } from "@/lib/reporting/access";
import { isFeatureEnabled, loadFlags, clearFlagCache } from "@/lib/flags";
import { updateList as updatePunchList, deleteList as deletePunchList, deleteItem as deletePunchItem } from "@/lib/punch/data";
import { buildDrafts, sendDraft } from "@/lib/prequal/decisions";
import { canDecidePrequal } from "@/lib/prequal/access";
import { loadDuplicatePairs, mergeCompanies } from "@/lib/companies/merge";
import { findDuplicateGroups } from "@/lib/contacts/merge";
import { listFolders, listFiles, createFolder } from "@/lib/files/data";
import { storageConfigured } from "@/lib/files/s3";
import { loadInvoices, createInvoice } from "@/lib/invoices/data";
import { invoiceRecipient, sendInvoiceEmail } from "@/lib/invoices/send";
import { loadJobMessages, postJobMessage } from "@/lib/job-messages/data";
import { updateJobNote, deleteJobNote, loadJobNotes } from "@/lib/job-notes/data";
import { reopenCommitment } from "@/lib/commitments/data";
import { loadOverviewData } from "@/lib/overview/data";
import { loadEngagementReport } from "@/lib/client-portal/reporting";
import { loadHiddenNav, saveHiddenNav } from "@/lib/nav-settings";
import { canSendOutbound } from "@/lib/notifications/outbound";
import { canWritePunch } from "@/lib/punch/types";
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
const isAdmin = (c: McpCaller) => ["super_admin", "admin"].includes(c.ctx.role);
const superAdmin = (c: McpCaller) => c.ctx.role === "super_admin";
const jobWrite = (c: McpCaller) => WRITE_ROLES.jobs.includes(c.ctx.role);
const staffActor = (c: McpCaller): CanvasActor => ({ kind: "staff", staffId: c.ctx.id, role: c.ctx.role });
const interviews = (c: McpCaller) => canUseInterviews(c.ctx.role);

// ─── Interviews ──────────────────────────────────────────────────────────────

const interviewTools: McpTool[] = [
  {
    name: "cmi_interviews",
    title: "Interviews",
    description: "Qualification interviews (trade partners and others). List them (status, q search, contact_id, company_id), or with id get one with its answers and follow-ups. templates: true lists the interview templates.",
    risk: "read",
    available: interviews,
    inputSchema: () => obj({ id: str("Interview id"), status: str("Status"), q: str("Search"), contact_id: str("Contact id"), company_id: str("Company id"), templates: bool("List templates") }),
    run: async (a) => {
      if (a.templates === true) return { result: { templates: await listInterviewTemplates() } };
      if (s(a.id)) { const [interview, followups] = await Promise.all([getInterview(s(a.id)), listFollowups(s(a.id))]); return { result: { interview, followups } as unknown as Json }; }
      return { result: { interviews: await listInterviews({ status: s(a.status) || undefined, q: s(a.q) || undefined, contactId: s(a.contact_id) || undefined, companyId: s(a.company_id) || undefined }) } };
    },
  },
  {
    name: "cmi_interview_create",
    title: "Start an interview",
    description: "Start an interview from a template (template_id) with a contact and/or company, optionally scheduled (scheduled_at ISO) and assigned to an interviewer (staff id). The interviewer is notified.",
    risk: "write",
    available: interviews,
    inputSchema: () => obj({ template_id: str("Template id"), contact_id: str("Contact id"), company_id: str("Company id"), interviewer_id: str("Interviewer staff id"), title: str("Title"), scheduled_at: str("ISO date-time"), duration_minutes: { type: "integer" }, meeting_type: str("phone, video, in person") }, ["template_id"]),
    run: async (a, c) => {
      const i = await createInterview({ templateId: s(a.template_id), contactId: s(a.contact_id) || null, companyId: s(a.company_id) || null, interviewerId: s(a.interviewer_id) || c.ctx.id, title: s(a.title) || null, scheduledAt: s(a.scheduled_at) || null, durationMinutes: typeof a.duration_minutes === "number" ? a.duration_minutes : null, meetingType: s(a.meeting_type) || null } as never, c.ctx.id);
      return { result: { interview: i as unknown as Json }, entity: "interview", recordId: (i as { id: string }).id, after: i };
    },
  },
  {
    name: "cmi_interview_update",
    title: "Record interview answers or finish it",
    description: "Save answers (answers: {question_key: value}), complete it (complete: true, apply_to_profile writes answers back onto the company, summary), reopen it (reopen: true), add a follow-up (followup_title, followup_due, followup_assigned_to), or tick a follow-up done (followup_id, done).",
    risk: "write",
    available: interviews,
    inputSchema: () => obj({
      id: str("Interview id"), answers: { type: "object", additionalProperties: true }, complete: bool("Complete it"), apply_to_profile: bool("Write answers onto the company profile"),
      summary: str("Summary"), reopen: bool("Reopen"), followup_title: str("New follow-up"), followup_due: str("Due ISO date"), followup_assigned_to: str("Staff id"),
      followup_id: str("Follow-up id"), done: bool("Follow-up done"),
    }, ["id"]),
    run: async (a, c) => {
      const id = s(a.id), out: Json = {};
      if (a.answers && typeof a.answers === "object") out.saved = await saveAnswers(id, a.answers as never, c.ctx.id);
      if (s(a.followup_title)) out.followup = await addFollowup(id, { title: s(a.followup_title), dueAt: s(a.followup_due) || null, assignedTo: s(a.followup_assigned_to) || null }, c.ctx.id);
      if (s(a.followup_id)) out.followup_done = await setFollowupDone(s(a.followup_id), a.done !== false, c.ctx.id);
      if (a.complete === true) out.completed = await completeInterview(id, { applyToProfile: a.apply_to_profile === true, summary: s(a.summary) || null }, c.ctx.id);
      if (a.reopen === true) out.reopened = await reopenInterview(id, c.ctx.id);
      if (!Object.keys(out).length) throw new Error("Nothing to do.");
      return { result: out, entity: "interview", recordId: id };
    },
  },
];

// ─── Canvas briefs ───────────────────────────────────────────────────────────

const canvasTools: McpTool[] = [
  {
    name: "cmi_canvas_briefs",
    title: "Canvas briefs",
    description: "Client photo-annotation briefs (Project Canvas). List them (status draft | submitted | in_review | responded, job), or with id get one with its scenes, pins and comments.",
    risk: "read",
    available: async () => canvasEnabled(),
    inputSchema: () => obj({ id: str("Canvas id"), status: str("Status"), job: str("Job id, number or name") }),
    run: async (a, c) => {
      if (s(a.id)) { const [cv, comments] = await Promise.all([getCanvasWithScenes(staffActor(c), s(a.id)), listCanvasComments(staffActor(c), s(a.id))]); return { result: { ...(cv as unknown as Json), comments } }; }
      const jobId = s(a.job) ? (await resolveJobId(a.job)).id : undefined;
      return { result: { canvases: await listCanvases(staffActor(c), { jobId, status: s(a.status) || undefined }) } };
    },
  },
  {
    name: "cmi_canvas_update",
    title: "Update a canvas brief",
    description: "Change a canvas brief's status (in_review, responded…), title or the job it belongs to.",
    risk: "write",
    available: async () => canvasEnabled(),
    inputSchema: () => obj({ id: str("Canvas id"), status: { type: "string", enum: ["draft", "submitted", "in_review", "responded"] }, title: str("Title"), job: str("Job id, number or name") }, ["id"]),
    run: async (a, c) => {
      const patch: Json = {};
      if (s(a.status)) patch.status = s(a.status);
      if (s(a.title)) patch.title = s(a.title);
      if (s(a.job)) patch.job_id = (await resolveJobId(a.job)).id;
      const cv = await updateCanvas(staffActor(c), s(a.id), patch as never);
      return { result: { canvas: cv }, entity: "canvas", recordId: s(a.id), after: cv };
    },
  },
  {
    name: "cmi_canvas_comment",
    title: "Comment on a canvas brief",
    description: "Reply on a canvas brief. The client who made it sees comments, so this previews first and runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: async () => canvasEnabled(),
    inputSchema: () => obj({ id: str("Canvas id"), body: str("Comment") }, ["id", "body"]),
    preview: async (a): Promise<Preview> => { if (!s(a.body)) throw new Error("Write the comment."); return { summary: `Comment on the canvas brief (the client sees it): "${s(a.body).slice(0, 140)}"`, entity: "canvas", recordId: s(a.id) }; },
    execute: async (a, c) => { const cm = await addCanvasComment(staffActor(c), s(a.id), s(a.body)); return { result: { comment: cm }, entity: "canvas", recordId: s(a.id), after: cm }; },
  },
];

// ─── Business card leads ─────────────────────────────────────────────────────

const cardTools: McpTool[] = [
  {
    name: "cmi_business_cards",
    title: "Business cards and their leads",
    description: "Your digital business cards (all cards for Super Admins) and the leads they captured. With card_id, that card's analytics (views, taps, saves) over range_days.",
    risk: "read",
    available: () => true,
    inputSchema: () => obj({ card_id: str("Card id (analytics)"), range_days: { type: "integer", minimum: 1, maximum: 365 } }),
    run: async (a, c) => {
      if (s(a.card_id)) return { result: (await loadCardAnalytics(s(a.card_id), typeof a.range_days === "number" ? a.range_days : 30)) as unknown as Json };
      const opts = { all: superAdmin(c), staffId: c.ctx.id };
      const [cards, leads] = await Promise.all([loadCardsForViewer(opts), loadLeads(opts)]);
      return { result: { cards: cards.map((x) => ({ id: x.id, name: x.display_name, slug: x.slug, status: x.status })), leads } };
    },
  },
  {
    name: "cmi_business_card_lead_status",
    title: "Update a business card lead",
    description: "Set a business card lead's status: new, contacted, qualified, archived.",
    risk: "write",
    available: () => true,
    inputSchema: () => obj({ lead_id: str("Lead id"), status: { type: "string", enum: ["new", "contacted", "qualified", "archived"] } }, ["lead_id", "status"]),
    run: async (a) => { await updateLeadStatus(s(a.lead_id), s(a.status) as never); return { result: { updated: true }, entity: "business_card_lead", recordId: s(a.lead_id) }; },
  },
];

// ─── Reporting and punch lists ───────────────────────────────────────────────

const reportingEdit = async (c: McpCaller) => canEditReports(c.ctx.role) && (await isFeatureEnabled(REPORTING_FLAG));

const editTools: McpTool[] = [
  {
    name: "cmi_report_edit",
    title: "Edit a meeting report",
    description: "Change a weekly meeting report's structure: add_section (title), add_item (section_id + title, notes as its status line, job_id to link a job), move_item (item_id, section_id, sort_order), delete_item (item_id), finalize (mark the report final) or reopen (back to draft).",
    risk: "write",
    available: reportingEdit,
    inputSchema: () => obj({
      report_id: str("Report id"), action: { type: "string", enum: ["add_section", "add_item", "move_item", "delete_item", "finalize", "reopen"] },
      title: str("Section or item title"), section_id: str("Section id"), item_id: str("Item id"), notes: str("Item notes"), job_id: str("Job id"), sort_order: { type: "integer" },
    }, ["report_id", "action"]),
    run: async (a) => {
      const rid = s(a.report_id);
      switch (a.action) {
        case "add_section": return { result: { section: await addSection(rid, s(a.title) || "New section") }, entity: "meeting_report", recordId: rid };
        case "add_item": { const p: Json = {}; if (s(a.title)) p.title = s(a.title); if (s(a.notes)) p.status_text = s(a.notes); if (s(a.job_id)) { p.record_type = "job"; p.record_id = s(a.job_id); } return { result: { item: await addItem(rid, s(a.section_id), p as never) }, entity: "meeting_report", recordId: rid }; }
        case "move_item": await moveItem(s(a.item_id), s(a.section_id), typeof a.sort_order === "number" ? a.sort_order : 0); return { result: { moved: true }, entity: "meeting_report", recordId: rid };
        case "delete_item": await deleteReportItem(s(a.item_id)); return { result: { deleted: true }, entity: "meeting_report", recordId: rid };
        case "finalize": return { result: { report: await updateReport(rid, { status: "final" } as never) }, entity: "meeting_report", recordId: rid };
        case "reopen": return { result: { report: await updateReport(rid, { status: "draft" } as never) }, entity: "meeting_report", recordId: rid };
        default: throw new Error("Unknown action.");
      }
    },
  },
  {
    name: "cmi_punch_list_update",
    title: "Rename or archive a punch list",
    description: "Change a punch list's title, description or archived state. To show a list to the client use cmi_punch_list_share.",
    risk: "write",
    available: (c) => canWritePunch(c.ctx.role),
    inputSchema: () => obj({ list_id: str("Punch list id"), title: str("Title"), description: str("Description"), archived: bool("Archived") }, ["list_id"]),
    run: async (a) => {
      const patch: Json = {};
      if (s(a.title)) patch.title = s(a.title);
      if (typeof a.description === "string") patch.description = a.description;
      if (typeof a.archived === "boolean") patch.archived = a.archived;
      const l = await updatePunchList(s(a.list_id), patch as never);
      return { result: { list: l }, entity: "punch_list", recordId: s(a.list_id), after: l };
    },
  },
  {
    name: "cmi_punch_list_share",
    title: "Show a punch list to the client",
    description: "Show (or hide) a job punch list in the client's portal. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => canWritePunch(c.ctx.role),
    inputSchema: () => obj({ list_id: str("Punch list id"), visible: bool("true = show (default), false = hide") }, ["list_id"]),
    preview: async (a): Promise<Preview> => ({ summary: `${a.visible === false ? "Hide" : "Show"} this punch list ${a.visible === false ? "from" : "to"} the client.`, entity: "punch_list", recordId: s(a.list_id) }),
    execute: async (a) => { const l = await updatePunchList(s(a.list_id), { client_visible: a.visible !== false }); return { result: { list: l }, entity: "punch_list", recordId: s(a.list_id), after: l }; },
  },
  {
    name: "cmi_punch_delete",
    title: "Delete a punch list or item",
    description: "Delete a whole punch list (list_id) or one item (item_id). Previews first; runs with cmi_confirm.",
    risk: "high",
    available: (c) => canWritePunch(c.ctx.role),
    inputSchema: () => obj({ list_id: str("Punch list id"), item_id: str("Item id") }),
    preview: async (a): Promise<Preview> => {
      if (!s(a.list_id) && !s(a.item_id)) throw new Error("Give list_id or item_id.");
      return { summary: s(a.item_id) ? "Delete this punch item." : "Delete this punch list and all its items.", entity: s(a.item_id) ? "punch_item" : "punch_list", recordId: s(a.item_id) || s(a.list_id) };
    },
    execute: async (a) => {
      if (s(a.item_id)) await deletePunchItem(s(a.item_id)); else await deletePunchList(s(a.list_id));
      return { result: { deleted: true }, entity: s(a.item_id) ? "punch_item" : "punch_list", recordId: s(a.item_id) || s(a.list_id), after: null };
    },
  },
];

// ─── Trade partners: follow-ups, company merge; contact duplicates ───────────

const partnerTools: McpTool[] = [
  {
    name: "cmi_trade_partner_followup_drafts",
    title: "Trade partner follow-up drafts",
    description: "The two follow-up emails for a trade partner application: book the qualification meeting, and ask for missing documents (with the list of what's missing and their upload link). Nothing is sent.",
    risk: "read",
    available: (c) => canDecidePrequal(c.ctx.role),
    inputSchema: () => obj({ application_id: str("Application id") }, ["application_id"]),
    run: async (a, c) => ({ result: (await buildDrafts(s(a.application_id), c.ctx.id)) as unknown as Json }),
  },
  {
    name: "cmi_trade_partner_followup_send",
    title: "Send a trade partner follow-up",
    description: "Email the applicant the meeting or missing-documents follow-up (kind meeting | missing; edit subject / body from cmi_trade_partner_followup_drafts). Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: (c) => canDecidePrequal(c.ctx.role),
    inputSchema: () => obj({ application_id: str("Application id"), kind: { type: "string", enum: ["meeting", "missing"] }, subject: str("Subject"), body: str("Body") }, ["application_id", "kind", "subject", "body"]),
    preview: async (a, c): Promise<Preview> => { const d = await buildDrafts(s(a.application_id), c.ctx.id); return { summary: `Email ${d.to ?? "the applicant"}: "${s(a.subject)}".`, details: { body: s(a.body) } }; },
    execute: async (a, c) => {
      if (!canSendOutbound()) return { result: { held: true, note: "Held: emails aren't sent outside production." } };
      const r = await sendDraft(s(a.application_id), c.ctx.id, { kind: a.kind === "missing" ? "missing" : "meeting", subject: s(a.subject), body: s(a.body) });
      return { result: r as unknown as Json, entity: "prequal_application", recordId: s(a.application_id), capGroup: "email" };
    },
  },
  {
    name: "cmi_duplicates",
    title: "Possible duplicate contacts or companies",
    description: "Likely duplicate contacts (kind contacts: same email, phone or name) or companies (kind companies). Merge contacts with cmi_contacts_merge and companies with cmi_companies_merge.",
    risk: "read",
    available: isAdmin,
    inputSchema: () => obj({ kind: { type: "string", enum: ["contacts", "companies"] } }, ["kind"]),
    run: async (a) => ({ result: a.kind === "companies" ? { pairs: await loadDuplicatePairs() } : { groups: await findDuplicateGroups() } as unknown as Json }),
  },
  {
    name: "cmi_companies_merge",
    title: "Merge two companies",
    description: "Merge a duplicate company into the one to keep (survivor_id); its contacts, documents and applications move over and the duplicate is removed. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: isAdmin,
    inputSchema: () => obj({ survivor_id: str("Company to keep"), duplicate_id: str("Company to merge in") }, ["survivor_id", "duplicate_id"]),
    preview: async (a): Promise<Preview> => {
      const { data } = await sb().from("companies").select("id, name").in("id", [s(a.survivor_id), s(a.duplicate_id)]);
      const n = (id: string) => (data ?? []).find((x) => x.id === id)?.name ?? id;
      return { summary: `Merge "${n(s(a.duplicate_id))}" into "${n(s(a.survivor_id))}". The duplicate is removed.`, entity: "company", recordId: s(a.survivor_id) };
    },
    execute: async (a, c) => ({ result: (await mergeCompanies(s(a.survivor_id), s(a.duplicate_id), c.ctx.id)) as unknown as Json, entity: "company", recordId: s(a.survivor_id) }),
  },
];

// ─── Cloud folders and prints ────────────────────────────────────────────────

const cloudTools: McpTool[] = [
  {
    name: "cmi_cloud_folders",
    title: "Cloud folders",
    description: "Browse CMI Cloud: the folders and files inside folder_id (top level when omitted), or create a folder (create: name, parent_id).",
    risk: "write",
    available: () => storageConfigured(),
    inputSchema: () => obj({ folder_id: str("Folder id (omit for top level)"), create: str("New folder name"), parent_id: str("Parent folder id for the new folder") }),
    run: async (a, c) => {
      if (s(a.create)) { const f = await createFolder({ name: s(a.create), parent_id: s(a.parent_id) || null }, c.ctx.id); return { result: { folder: f }, entity: "cloud_folder", recordId: f.id, after: f }; }
      const scope = { folderId: s(a.folder_id) || null };
      const [folders, files] = await Promise.all([listFolders(scope), listFiles(scope)]);
      return { result: { folders, files } as unknown as Json };
    },
  },
  {
    name: "cmi_prints",
    title: "Prints and flyers",
    description: "The print documents (flyers, one-pagers) from Communications → Prints, or with id one of them. Build and edit them in the dashboard; delete with delete: true (previews first, admins).",
    risk: "read",
    available: () => true,
    inputSchema: () => obj({ id: str("Print id") }),
    run: async (a) => {
      if (s(a.id)) { const { data } = await sb().from("print_documents").select("*").eq("id", s(a.id)).maybeSingle(); return { result: { print: data } }; }
      const { data } = await sb().from("print_documents").select("id, name, page_size, orientation, status, updated_at").order("updated_at", { ascending: false }).limit(200);
      return { result: { prints: data ?? [] } };
    },
  },
];

// ─── Invoices, client messages, job notes, commitments ───────────────────────

const jobMoreTools: McpTool[] = [
  {
    name: "cmi_invoices",
    title: "Job invoices",
    description: "A job's invoices with line items, amounts and status (financial roles).",
    risk: "read",
    available: (c) => c.ctx.isAdmin,
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: async (a) => { const job = await resolveJobId(a.job); return { result: { job: job.label, invoices: await loadInvoices(job.id) } }; },
  },
  {
    name: "cmi_invoice_create",
    title: "Create an invoice",
    description: "Create a draft invoice on a job with line items [{description, quantity, unit_price}], optional title, due_date (YYYY-MM-DD) and notes. It isn't sent; send it with cmi_invoice_send.",
    risk: "write",
    available: (c) => c.ctx.isAdmin,
    inputSchema: () => obj({ job: str("Job id, number or name"), title: str("Title"), due_date: str("YYYY-MM-DD"), notes: str("Notes"), items: { type: "array", items: { type: "object" } } }, ["job", "items"]),
    run: async (a, c) => {
      const job = await resolveJobId(a.job);
      const draft: Json = { status: "draft" };
      if (s(a.title)) draft.title = s(a.title);
      if (s(a.due_date)) draft.due_date = s(a.due_date);
      if (s(a.notes)) draft.notes = s(a.notes);
      const items = ((a.items as Json[]) ?? []).map((i) => ({ description: s(i.description), quantity: Number(i.quantity ?? 1), unit_price: Number(i.unit_price ?? 0) })).filter((i) => i.description);
      if (!items.length) throw new Error("Add at least one line item.");
      const inv = await createInvoice(job.id, draft as never, items, c.ctx.email);
      return { result: { invoice: inv }, entity: "invoice", recordId: inv.id, after: inv };
    },
  },
  {
    name: "cmi_invoice_send",
    title: "Email an invoice to the client",
    description: "Email the invoice PDF to the job's primary client (or `to`), and mark it sent. Respects email opt-outs. Held outside production. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: (c) => c.ctx.isAdmin,
    inputSchema: () => obj({ job: str("Job id, number or name"), invoice_id: str("Invoice id"), to: str("Send to this email instead") }, ["job", "invoice_id"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      const to = await invoiceRecipient(job.id, s(a.to) || null);
      return { summary: `Email the invoice PDF for ${job.label} to ${to} and mark it sent.`, entity: "invoice", recordId: s(a.invoice_id) };
    },
    execute: async (a) => {
      const job = await resolveJobId(a.job);
      if (!canSendOutbound()) return { result: { held: true, note: "Held: invoices aren't emailed outside production." } };
      const r = await sendInvoiceEmail(job.id, s(a.invoice_id), s(a.to) || null);
      return { result: { sent: true, to: r.to }, entity: "invoice", recordId: s(a.invoice_id), capGroup: "email" };
    },
  },
  {
    name: "cmi_job_portal_messages",
    title: "Client portal messages",
    description: "A job's message thread with its client (the portal's Messages), oldest first, including internal notes left there.",
    risk: "read",
    available: () => true,
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: async (a) => { const job = await resolveJobId(a.job); return { result: { job: job.label, messages: await loadJobMessages(job.id) } }; },
  },
  {
    name: "cmi_job_portal_message_send",
    title: "Message the client in the portal",
    description: "Post in a job's client message thread. Client-visible messages notify the client; visibility internal adds a team-only note to the thread. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => ["super_admin", "admin", "project_manager", "estimator", "superintendent"].includes(c.ctx.role),
    inputSchema: () => obj({ job: str("Job id, number or name"), body: str("Message"), visibility: { type: "string", enum: ["client_visible", "internal"] } }, ["job", "body"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      if (!s(a.body)) throw new Error("Write the message.");
      return { summary: a.visibility === "internal" ? `Add a team-only note to ${job.label}'s client thread.` : `Message the client on ${job.label} (they're notified): "${s(a.body).slice(0, 140)}"`, entity: "job", recordId: job.id };
    },
    execute: async (a, c) => {
      const job = await resolveJobId(a.job);
      const m = await postJobMessage(job.id, { body: s(a.body), visibility: s(a.visibility) || "client_visible" }, { id: c.ctx.id, name: c.ctx.email });
      return { result: { posted: m }, entity: "job_message", recordId: (m as { id: string }).id, after: m };
    },
  },
  {
    name: "cmi_job_notes",
    title: "Job notes",
    description: "A job's internal notes, or change one: pin / unpin (pinned), edit (body), or delete (delete: true; previews are not needed for staff-only notes).",
    risk: "write",
    available: jobWrite,
    inputSchema: () => obj({ job: str("Job id, number or name (list)"), note_id: str("Note id"), body: str("New text"), pinned: bool("Pinned"), delete: bool("Delete the note") }),
    run: async (a) => {
      if (s(a.note_id)) {
        if (a.delete === true) { await deleteJobNote(s(a.note_id)); return { result: { deleted: true }, entity: "job_note", recordId: s(a.note_id), after: null }; }
        const patch: Json = {};
        if (typeof a.pinned === "boolean") patch.pinned = a.pinned;
        if (s(a.body)) patch.body = s(a.body);
        const n = await updateJobNote(s(a.note_id), patch as never);
        return { result: { note: n }, entity: "job_note", recordId: s(a.note_id), after: n };
      }
      const job = await resolveJobId(a.job);
      return { result: { job: job.label, notes: await loadJobNotes(job.id) } };
    },
  },
  {
    name: "cmi_commitments_reopen",
    title: "Reopen a commitment",
    description: "Reopen a resolved or dismissed commitment.",
    risk: "write",
    available: () => true,
    inputSchema: () => obj({ id: str("Commitment id") }, ["id"]),
    run: async (a, c) => { const r = await reopenCommitment(s(a.id), { id: c.ctx.id }); return { result: r as unknown as Json, entity: "commitment", recordId: s(a.id) }; },
  },
];

// ─── Snapshots, flags, sidebar ───────────────────────────────────────────────

const adminTools: McpTool[] = [
  {
    name: "cmi_overview",
    title: "Dashboard overview",
    description: "The Overview page's numbers: pipeline, jobs, revenue snapshot, recent activity.",
    risk: "read",
    available: (c) => c.ctx.isAdmin,
    inputSchema: () => obj(),
    run: async () => ({ result: (await loadOverviewData()) as unknown as Json }),
  },
  {
    name: "cmi_client_engagement",
    title: "Client engagement",
    description: "How clients use the portal: logins, views, approvals and messages per job.",
    risk: "read",
    available: isAdmin,
    inputSchema: () => obj(),
    run: async () => ({ result: (await loadEngagementReport()) as unknown as Json }),
  },
  {
    name: "cmi_feature_flags",
    title: "Feature flags",
    description: "The dashboard's feature switches (Settings → Features) and whether each is on.",
    risk: "read",
    available: isAdmin,
    inputSchema: () => obj(),
    run: async () => ({ result: { flags: await loadFlags(true) } }),
  },
  {
    name: "cmi_feature_flag_set",
    title: "Turn a feature on or off",
    description: "Super Admin: switch a dashboard feature on or off for everyone (key from cmi_feature_flags). Previews first; runs with cmi_confirm.",
    risk: "high",
    available: superAdmin,
    inputSchema: () => obj({ key: str("Flag key"), enabled: bool("On or off") }, ["key", "enabled"]),
    preview: async (a): Promise<Preview> => {
      const flags = await loadFlags(true);
      if (!(s(a.key) in flags)) throw new Error(`No feature flag "${s(a.key)}".`);
      return { summary: `Turn the "${s(a.key)}" feature ${a.enabled ? "on" : "off"} for everyone (it's ${flags[s(a.key)] ? "on" : "off"} now).`, entity: "feature_flag", recordId: s(a.key) };
    },
    execute: async (a) => {
      const { data, error } = await sb().from("feature_flags").update({ enabled: a.enabled === true, updated_at: new Date().toISOString() }).eq("key", s(a.key)).select("*").single();
      if (error) throw new Error(error.message);
      clearFlagCache();
      return { result: { flag: data }, entity: "feature_flag", recordId: s(a.key), after: data };
    },
  },
  {
    name: "cmi_sidebar_navigation",
    title: "Sidebar navigation",
    description: "Super Admin: which sidebar items are hidden for everyone (Settings → Sidebar Navigation), or set the hidden list (hidden: array of hrefs like /dashboard/portfolio).",
    risk: "write",
    available: superAdmin,
    inputSchema: () => obj({ hidden: { type: "array", items: { type: "string" } } }),
    run: async (a, c) => {
      if (Array.isArray(a.hidden)) return { result: { hidden: await saveHiddenNav(a.hidden.map((x) => s(x)).filter(Boolean), c.ctx.id) }, entity: "nav_settings" };
      return { result: { hidden: await loadHiddenNav(true) } };
    },
  },
];

export function dashboardMoreTools(): McpTool[] {
  return [...interviewTools, ...canvasTools, ...cardTools, ...editTools, ...partnerTools, ...cloudTools, ...jobMoreTools, ...adminTools];
}
