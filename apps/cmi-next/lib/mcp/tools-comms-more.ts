// More communication tools: Field Reports (the day log lifecycle), moving a
// daily log, executive summaries, direct messages between staff, the bell,
// Super Admin broadcasts and the morning briefing, messaging consent, and the
// warranty queue. Anything that reaches people outside the team (or pushes to
// everyone) previews first and runs with cmi_confirm.
import { listDayLogs, updateDayLog, submitDayLog, reopenDayLog, dayLogChanges, fieldReportsOn } from "@/lib/daily-logs/reports";
import { editDailyLog, cleanEdit } from "@/lib/daily-logs/edit";
import { buildSnapshot } from "@/lib/exec-summary/snapshot";
import { generateSummary } from "@/lib/exec-summary/generate";
import { sectionsToHtml } from "@/lib/exec-summary/render";
import { sendSummary, loadHistory, loadRecipients, SUMMARY_ROLES } from "@/lib/exec-summary/deliver";
import { listConversations, getThread, sendMessage, findOrCreateConversation, listMessageableUsers, getUnreadCount } from "@/lib/direct-messages/data";
import { loadStaffNotifications, markStaffNotificationRead, markAllStaffNotificationsRead } from "@/lib/notifications/staff";
import { createBroadcast, listBroadcasts, fanOutToClients, staffPushRecipients, type BroadcastAudience } from "@/lib/broadcasts/data";
import { sendPushToClients, sendPushToStaff } from "@/lib/push/web-push";
import { loadBriefingSettings, saveBriefingSettings } from "@/lib/briefing/settings";
import { runBriefings, loadBriefingHistory } from "@/lib/briefing/send";
import { loadConsentSummary, applyConsent, type Channel, type ConsentAction } from "@/lib/messaging/consent";
import { loadWarrantyRequests, updateWarrantyRequest } from "@/lib/pipeline/data";
import { canSendOutbound } from "@/lib/notifications/outbound";
import { getEntity } from "@/lib/agent/entities";
import { entityAllowed } from "./policy";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { resolveJobId } from "./tools-crm";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });
const strList = (description: string) => ({ type: "array", items: { type: "string" }, description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : []);
const actor = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName || c.ctx.email || "Staff", email: c.ctx.email });
const superAdmin = (c: McpCaller) => c.ctx.role === "super_admin";
const isAdmin = (c: McpCaller) => ["super_admin", "admin"].includes(c.ctx.role);
const seesLogs = (c: McpCaller) => !!getEntity("daily_log") && entityAllowed("daily_log", c.ctx);
const summaryRole = (c: McpCaller) => (SUMMARY_ROLES as readonly string[]).includes(c.ctx.role);
const notifyCtx = (c: McpCaller) => ({ email: c.ctx.email, staffId: c.ctx.id, isAdmin: isAdmin(c), role: c.ctx.role });

// ─── Field Reports / daily logs ──────────────────────────────────────────────

const logTools: McpTool[] = [
  {
    name: "cmi_field_reports",
    title: "Field Reports (day logs)",
    description: "A job's Field Reports (one day log per day, with sections, weather and status), optionally between from / to dates. With log_id, also the change history of that log.",
    risk: "read",
    available: seesLogs,
    inputSchema: () => obj({ job: str("Job id, number or name"), from: str("YYYY-MM-DD"), to: str("YYYY-MM-DD"), log_id: str("A log id (adds its change history)") }, ["job"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      const logs = await listDayLogs(job.id, { from: s(a.from) || undefined, to: s(a.to) || undefined });
      return { result: { job: job.label, field_reports_on: await fieldReportsOn(), logs, ...(s(a.log_id) ? { changes: await dayLogChanges(s(a.log_id)) } : {}) } };
    },
  },
  {
    name: "cmi_field_report_update",
    title: "Edit a Field Report",
    description: "Change a day log's sections, weather, temperature or notes (notes_html) before it's submitted.",
    risk: "write",
    available: seesLogs,
    inputSchema: () => obj({ log_id: str("Day log id"), sections: { type: "object", description: "Sections as the log stores them" }, weather: str("Weather"), temperature: str("Temperature"), notes_html: str("Notes (HTML)") }, ["log_id"]),
    run: async (a, c) => {
      const patch: Json = {};
      if (a.sections && typeof a.sections === "object") patch.sections = a.sections;
      for (const k of ["weather", "temperature", "notes_html"]) if (typeof a[k] === "string") patch[k] = a[k];
      const log = await updateDayLog(s(a.log_id), patch as never, actor(c));
      return { result: { log }, entity: "daily_log", recordId: s(a.log_id), after: log };
    },
  },
  {
    name: "cmi_field_report_submit",
    title: "Submit or reopen a Field Report",
    description: "Submit a day log (locks it and turns its follow-ups into Commitments), or reopen a submitted one (reopen: true) to edit it again.",
    risk: "write",
    available: seesLogs,
    inputSchema: () => obj({ log_id: str("Day log id"), reopen: bool("Reopen instead of submit") }, ["log_id"]),
    run: async (a, c) => {
      if (a.reopen === true) { const log = await reopenDayLog(s(a.log_id), actor(c)); return { result: { reopened: true, log }, entity: "daily_log", recordId: s(a.log_id), after: log }; }
      const r = await submitDayLog(s(a.log_id), actor(c));
      return { result: { submitted: true, commitments_created: r.commitments, failed: r.failed }, entity: "daily_log", recordId: s(a.log_id), after: r.log };
    },
  },
  {
    name: "cmi_daily_log_edit",
    title: "Move or edit a daily log entry",
    description: "Move a daily log to another job (job), or change its notes, visibility (team | private), include_in_brief, or client_visible (shown in the client's portal).",
    risk: "write",
    available: seesLogs,
    inputSchema: () => obj({ log_id: str("Daily log id"), job: str("Move it to this job (id, number or name)"), notes: str("Notes"), visibility: { type: "string", enum: ["team", "private"] }, include_in_brief: bool("Include in the Daily Brief") }, ["log_id"]),
    run: async (a, c) => {
      const b: Json = {};
      if (typeof a.notes === "string") b.notes = a.notes;
      if (s(a.visibility)) b.visibility = s(a.visibility);
      if (typeof a.include_in_brief === "boolean") b.include_in_brief = a.include_in_brief;
      if (s(a.job)) b.jobId = (await resolveJobId(a.job)).id;
      const r = await editDailyLog(s(a.log_id), cleanEdit(b), actor(c));
      return { result: r as unknown as Json, entity: "daily_log", recordId: s(a.log_id), after: r.log };
    },
  },
];

// ─── Executive summaries ─────────────────────────────────────────────────────

async function draft(a: Json) {
  const target = a.target === "precon" ? "precon" : "job";
  const id = target === "job" ? (await resolveJobId(a.id)).id : s(a.id);
  const audience = a.audience === "client" ? "client" : "team";
  const snap = await buildSnapshot(target, id, audience, { periodStart: s(a.period_start) || null, periodEnd: s(a.period_end) || null });
  if (!snap) throw new Error("That record wasn't found.");
  const g = await generateSummary(snap, audience, s(a.guidance) || null);
  return { target, id, audience, snap, g, body_html: sectionsToHtml(g) } as const;
}
const SUMMARY_ARGS = {
  target: { type: "string", enum: ["job", "precon"] }, id: str("Job (id, number or name) or Pre-Con record id"),
  audience: { type: "string", enum: ["team", "client"] }, guidance: str("Anything to stress or leave out"),
  period_start: str("YYYY-MM-DD"), period_end: str("YYYY-MM-DD"),
};

const summaryTools: McpTool[] = [
  {
    name: "cmi_exec_summary_draft",
    title: "Draft an executive summary",
    description: "Have Bolt draft a team or client executive summary for a job or Pre-Con record (headline, opening, key facts, completed, coming soon, body). Nothing is saved or sent; use cmi_exec_summary_send to send one.",
    risk: "read",
    available: summaryRole,
    inputSchema: () => obj(SUMMARY_ARGS, ["target", "id"]),
    run: async (a) => {
      const d = await draft(a);
      return { result: { project: { name: d.snap.name, number: d.snap.number }, audience: d.audience, headline: d.g.headline, opening: d.g.opening, facts: d.g.facts, completed: d.g.completed, coming_soon: d.g.coming_soon, body_html: d.body_html } };
    },
  },
  {
    name: "cmi_exec_summary_recipients",
    title: "Executive summary recipients and history",
    description: "Who an executive summary can go to (staff on the job, client contacts) and the summaries already sent.",
    risk: "read",
    available: summaryRole,
    inputSchema: () => obj({ target: { type: "string", enum: ["job", "precon"] }, id: str("Job (id, number or name) or Pre-Con id") }, ["target", "id"]),
    run: async (a) => {
      const target = a.target === "precon" ? "precon" : "job";
      const id = target === "job" ? (await resolveJobId(a.id)).id : s(a.id);
      const [recipients, history] = await Promise.all([loadRecipients(target, id), loadHistory(target, id)]);
      return { result: { recipients, history } as unknown as Json };
    },
  },
  {
    name: "cmi_exec_summary_send",
    title: "Send an executive summary",
    description: "Draft and send an executive summary by email (or, for clients, a text with a link) to staff_ids and/or contact_ids (cmi_exec_summary_recipients), optionally posting it to the client portal. A PDF copy is saved to the job's files. Held outside production. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: summaryRole,
    inputSchema: () => obj({ ...SUMMARY_ARGS, staff_ids: strList("Staff ids"), contact_ids: strList("Client contact ids"), channel: { type: "string", enum: ["email", "sms"] }, post_to_portal: bool("Also post to the client portal"), note: str("A personal note above it") }, ["target", "id"]),
    preview: async (a): Promise<Preview> => {
      const n = ids(a.staff_ids).length + ids(a.contact_ids).length;
      if (!n && a.post_to_portal !== true) throw new Error("Pick who it goes to (staff_ids, contact_ids) or post_to_portal.");
      return { summary: `Draft a ${a.audience === "client" ? "client" : "team"} executive summary and send it to ${n} recipient${n === 1 ? "" : "s"}${a.post_to_portal === true ? ", and post it to the client portal" : ""}.`, details: { staff_ids: ids(a.staff_ids), contact_ids: ids(a.contact_ids), channel: s(a.channel) || "email" } };
    },
    execute: async (a, c) => {
      if (!canSendOutbound()) return { result: { held: true, note: "Executive summaries aren't sent outside production." } };
      const d = await draft(a);
      const r = await sendSummary({
        target: d.target, id: d.id, audience: d.audience, headline: d.g.headline, opening: d.g.opening, facts: d.g.facts, completed: d.g.completed,
        coming_soon: d.g.coming_soon, photos: [], body_html: d.body_html, note: s(a.note) || null, channel: a.channel === "sms" ? "sms" : "email",
        staff_ids: ids(a.staff_ids), contact_ids: ids(a.contact_ids), post_to_portal: a.post_to_portal === true,
        period_start: s(a.period_start) || null, period_end: s(a.period_end) || null,
      } as never, { id: c.ctx.id, name: c.ctx.displayName || c.ctx.email, role: c.ctx.role });
      return { result: r as unknown as Json, entity: d.target === "job" ? "job" : "opportunity", recordId: d.id, capGroup: "email" };
    },
  },
];

// ─── Direct messages ─────────────────────────────────────────────────────────

const dmTools: McpTool[] = [
  {
    name: "cmi_dm_threads",
    title: "Your direct messages",
    description: "Your direct-message conversations (newest first) and unread count, optionally filtered by search or job_id. With conversation_id, that conversation's messages.",
    risk: "read",
    available: () => true,
    inputSchema: () => obj({ conversation_id: str("Conversation id"), search: str("Search"), job_id: str("Job id") }),
    run: async (a, c) => {
      if (s(a.conversation_id)) return { result: (await getThread(c.ctx.id, s(a.conversation_id))) as unknown as Json };
      const [conversations, unread] = await Promise.all([listConversations(c.ctx.id, { search: s(a.search) || undefined, jobId: s(a.job_id) || undefined }), getUnreadCount(c.ctx.id)]);
      return { result: { unread, conversations } };
    },
  },
  {
    name: "cmi_dm_people",
    title: "People you can message",
    description: "Staff you can start a direct message with (search by name or email).",
    risk: "read",
    available: () => true,
    inputSchema: () => obj({ search: str("Name or email") }),
    run: async (a, c) => ({ result: { people: await listMessageableUsers(c.ctx.id, s(a.search) || undefined) } }),
  },
  {
    name: "cmi_dm_send",
    title: "Send a direct message",
    description: "Send a direct message as you, in an existing conversation (conversation_id) or to a teammate (to_staff_id, optionally about job_id). They get a bell and push notification. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: () => true,
    inputSchema: () => obj({ conversation_id: str("Conversation id"), to_staff_id: str("Teammate's staff id (cmi_dm_people)"), job_id: str("Job id (optional)"), body: str("Message"), importance: { type: "string", enum: ["normal", "high", "urgent"] } }, ["body"]),
    preview: async (a): Promise<Preview> => {
      if (!s(a.body)) throw new Error("Write the message.");
      if (!s(a.conversation_id) && !s(a.to_staff_id)) throw new Error("Give conversation_id or to_staff_id.");
      return { summary: `Send a direct message: "${s(a.body).slice(0, 140)}"`, details: { conversation_id: s(a.conversation_id) || null, to_staff_id: s(a.to_staff_id) || null } };
    },
    execute: async (a, c) => {
      const conv = s(a.conversation_id) || await findOrCreateConversation({ id: c.ctx.id, kind: "staff" }, { id: s(a.to_staff_id), kind: "staff" }, s(a.job_id) || null);
      const m = await sendMessage(c.ctx.id, conv, { body: s(a.body), importance: (s(a.importance) || "normal") as never });
      return { result: { sent: true, conversation_id: conv, message: m as unknown as Json }, entity: "dm_conversation", recordId: conv };
    },
  },
];

// ─── Bell, broadcasts, briefing ──────────────────────────────────────────────

const noticeTools: McpTool[] = [
  {
    name: "cmi_notifications",
    title: "Your notifications (the bell)",
    description: "Your bell: new form submissions, messages, leads, notes, bookings, DMs, broadcasts, schedule alerts. Mark one read (kind + id) or all read (mark_all).",
    risk: "write",
    available: () => true,
    inputSchema: () => obj({ mark_read_kind: str("Kind of the one to mark read"), mark_read_id: str("Its id"), mark_all: bool("Mark everything read") }),
    run: async (a, c) => {
      const ctx = notifyCtx(c);
      if (a.mark_all === true) return { result: { marked: await markAllStaffNotificationsRead(ctx) } };
      if (s(a.mark_read_kind) && s(a.mark_read_id)) return { result: { marked: await markStaffNotificationRead(ctx, s(a.mark_read_kind) as never, s(a.mark_read_id)) } };
      return { result: { notifications: await loadStaffNotifications(ctx) } };
    },
  },
  {
    name: "cmi_broadcasts",
    title: "Broadcast notifications",
    description: "Super Admin: past broadcasts (everyone, staff, clients or one role).",
    risk: "read",
    available: superAdmin,
    inputSchema: () => obj({ limit: { type: "integer", minimum: 1, maximum: 200 } }),
    run: async (a) => ({ result: { broadcasts: await listBroadcasts(typeof a.limit === "number" ? a.limit : 50) } }),
  },
  {
    name: "cmi_broadcast_send",
    title: "Send a broadcast",
    description: "Super Admin: send an announcement to everyone, staff, clients or one role (target_role). It lands in their bell and as a push notification. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: superAdmin,
    inputSchema: () => obj({ title: str("Title"), body: str("Message"), link: str("Link (optional)"), audience: { type: "string", enum: ["all", "staff", "clients", "role"] }, target_role: str("Role (audience role)") }, ["title", "body", "audience"]),
    preview: async (a): Promise<Preview> => {
      if (!s(a.title) || !s(a.body)) throw new Error("Give a title and message.");
      return { summary: `Broadcast "${s(a.title)}" to ${a.audience === "role" ? `the ${s(a.target_role)} role` : s(a.audience)} (bell + push).`, details: { body: s(a.body), link: s(a.link) || null } };
    },
    execute: async (a, c) => {
      const b = await createBroadcast({ title: s(a.title), body: s(a.body), link: s(a.link) || null, audience: s(a.audience) as BroadcastAudience, target_role: s(a.target_role) || null, createdByStaffId: c.ctx.id, createdByName: c.ctx.displayName || c.ctx.email });
      const staffIds = await staffPushRecipients(b).catch(() => [] as string[]);
      const [, clientIds] = await Promise.all([
        staffIds.length ? sendPushToStaff(staffIds, { title: b.title, body: b.body, url: b.link || "/dashboard/overview", tag: `broadcast-${b.id}` }).catch(() => {}) : Promise.resolve(),
        fanOutToClients(b).catch(() => [] as string[]),
      ]);
      if ((clientIds as string[]).length) await sendPushToClients(clientIds as string[], { title: b.title, body: b.body, url: b.link || "/client/jobs", tag: `broadcast-${b.id}` }).catch(() => {});
      return { result: { sent: true, broadcast: b, staff: staffIds.length, clients: (clientIds as string[]).length }, entity: "broadcast", recordId: b.id };
    },
  },
  {
    name: "cmi_briefing",
    title: "Morning briefing settings",
    description: "Super Admin: the morning briefing email settings and recent sends, or change them (auto_enabled, audience all | selected, recipient_ids, include_ai, weekdays_only).",
    risk: "write",
    available: superAdmin,
    inputSchema: () => obj({ save: bool("Save changes"), auto_enabled: bool("Send automatically"), audience: { type: "string", enum: ["all", "selected"] }, recipient_ids: strList("Staff ids (selected)"), include_ai: bool("Include the AI summary"), weekdays_only: bool("Skip weekends") }),
    run: async (a, c) => {
      if (a.save === true) {
        const patch: Json = {};
        for (const k of ["auto_enabled", "include_ai", "weekdays_only"]) if (typeof a[k] === "boolean") patch[k] = a[k];
        if (s(a.audience)) patch.audience = s(a.audience);
        if (Array.isArray(a.recipient_ids)) patch.recipient_ids = ids(a.recipient_ids);
        return { result: { settings: await saveBriefingSettings(patch as never, c.ctx.id) }, entity: "briefing_settings" };
      }
      const [settings, history] = await Promise.all([loadBriefingSettings(), loadBriefingHistory(20)]);
      return { result: { settings, history } as unknown as Json };
    },
  },
  {
    name: "cmi_briefing_send_now",
    title: "Send the morning briefing now",
    description: "Super Admin: send today's briefing now to everyone (all) or recipient_ids, or a test to one email (test_to). Held outside production. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: superAdmin,
    inputSchema: () => obj({ test_to: str("Send a test to this staff email only"), recipient_ids: strList("Staff ids (omit for everyone)"), resend: bool("Send even to people who already had today's") }),
    preview: async (a): Promise<Preview> => ({ summary: s(a.test_to) ? `Send a test briefing to ${s(a.test_to)}.` : `Send today's briefing now to ${ids(a.recipient_ids).length ? `${ids(a.recipient_ids).length} people` : "everyone"}.` }),
    execute: async (a) => {
      const r = await runBriefings(s(a.test_to) ? { testTo: s(a.test_to) } : { trigger: "manual", recipientIds: ids(a.recipient_ids).length ? ids(a.recipient_ids) : "all", ...(a.resend === true ? { force: true } : {}) } as never);
      return { result: r as unknown as Json, entity: "briefing" };
    },
  },
];

// ─── Consent and warranty ────────────────────────────────────────────────────

const consentTools: McpTool[] = [
  {
    name: "cmi_consent_summary",
    title: "Messaging consent",
    description: "Text and email opt-ins and opt-outs (A2P / CAN-SPAM): counts, recent changes and who's opted out.",
    risk: "read",
    available: isAdmin,
    inputSchema: () => obj(),
    run: async () => ({ result: (await loadConsentSummary()) as unknown as Json }),
  },
  {
    name: "cmi_consent_apply",
    title: "Record an opt-in or opt-out",
    description: "Record that someone opted in to, or out of, texts or email (channel sms | email, action opt_in | opt_out, address, categories service | marketing, source). Opting in allows us to message them, so it previews first and runs with cmi_confirm.",
    risk: "high",
    available: isAdmin,
    inputSchema: () => obj({ channel: { type: "string", enum: ["sms", "email"] }, action: { type: "string", enum: ["opt_in", "opt_out"] }, address: str("Phone or email"), categories: strList("service, marketing"), source: str("How we got it (e.g. phone call, signed form)"), contact_id: str("Contact id") }, ["channel", "action", "address", "source"]),
    preview: async (a): Promise<Preview> => ({ summary: `Record ${s(a.address)} as ${a.action === "opt_in" ? "opted in to" : "opted out of"} ${a.channel === "sms" ? "texts" : "email"} (${s(a.source)}).` }),
    execute: async (a, c) => {
      const r = await applyConsent({ channel: s(a.channel) as Channel, action: s(a.action) as ConsentAction, address: s(a.address), source: s(a.source), categories: ids(a.categories) as never, actorStaffId: c.ctx.id, contactId: s(a.contact_id) || null });
      return { result: r as unknown as Json, entity: "messaging_consent" };
    },
  },
  {
    name: "cmi_warranty_requests",
    title: "Warranty requests",
    description: "The warranty queue (requests from clients and staff), optionally only open ones or one job's.",
    risk: "read",
    available: (c) => !!getEntity("warranty_request") && entityAllowed("warranty_request", c.ctx),
    inputSchema: () => obj({ job: str("Job id, number or name"), open_only: bool("Only open requests") }),
    run: async (a) => {
      let rows = (await loadWarrantyRequests()) as unknown as Json[];
      if (s(a.job)) { const j = await resolveJobId(a.job); rows = rows.filter((r) => r.job_id === j.id); }
      if (a.open_only === true) rows = rows.filter((r) => !/closed|resolved|complete|denied/i.test(String(r.status ?? "")));
      return { result: { count: rows.length, requests: rows } };
    },
  },
  {
    name: "cmi_warranty_update",
    title: "Update a warranty request",
    description: "Change a warranty request's status, priority, assigned_to, scheduled_date, resolution or internal notes. This doesn't message the client; tell them with cmi_job_update_post or a message if needed.",
    risk: "write",
    available: (c) => !!getEntity("warranty_request") && entityAllowed("warranty_request", c.ctx),
    inputSchema: () => obj({ id: str("Warranty request id"), changes: { type: "object", additionalProperties: true } }, ["id", "changes"]),
    run: async (a) => {
      const after = await updateWarrantyRequest(s(a.id), (a.changes as Json) as never);
      return { result: { request: after }, entity: "warranty_request", recordId: s(a.id), after };
    },
  },
];

export function commsMoreTools(): McpTool[] {
  return [...logTools, ...summaryTools, ...dmTools, ...noticeTools, ...consentTools];
}
