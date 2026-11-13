// MCP tools for working with a job's clients: selection comment threads, the
// job's client activity, the job team (staff and clients, with portal
// permissions), client portal settings and invites, and sharing files and
// photos with the client. Anything the client sees or receives previews first
// and runs with cmi_confirm (risk "high").
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listComments, addStaffReply, setHandled, commentSummaries } from "@/lib/selection-comments/data";
import { loadClientFeed } from "@/lib/jobs/client-feed";
import {
  getJob, updateJob, addJobInternalUser, updateJobInternalUser, removeJobInternalUser,
  addJobContact, updateJobContact, removeJobContact,
} from "@/lib/jobs/data";
import { sendClientInvite } from "@/lib/client-portal/notify";
import { canSendOutbound } from "@/lib/notifications/outbound";
import { setJobFilesClientVisible, loadJobFiles } from "@/lib/job-files/data";
import { listPhotos, photoFacets, updatePhotos } from "@/lib/photos/data";
import { WRITE_ROLES } from "@/lib/records-io/fields";
import { getEntity } from "@/lib/agent/entities";
import { entityAllowed } from "./policy";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { resolveJobId, staffIdFor } from "./tools-crm";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });
const strList = (description: string) => ({ type: "array", items: { type: "string" }, description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : []);
const sb = () => getSupabaseAdmin();

const sees = (key: string) => (c: McpCaller) => !!getEntity(key) && entityAllowed(key, c.ctx);
const jobWrite = (c: McpCaller) => WRITE_ROLES.jobs.includes(c.ctx.role);
const staffOf = (c: McpCaller) => ({ id: c.ctx.id, name: c.ctx.displayName || c.ctx.email || "Staff" });

async function selectionJob(selectionId: string): Promise<{ id: string; name: string; jobId: string | null }> {
  const { data } = await sb().from("project_selections").select("id, name, job_id").eq("id", selectionId).maybeSingle();
  if (!data) throw new Error("No selection with that id.");
  return { id: data.id as string, name: (data.name as string) ?? "Selection", jobId: (data.job_id as string | null) ?? null };
}

// ─── Selection comment threads ───────────────────────────────────────────────

const commentTools: McpTool[] = [
  {
    name: "cmi_selection_comments",
    title: "Selection comments",
    description: "Read the client comment thread on one selection (selection_id), or for a whole job (job) the comment count, unhandled count and latest comment per selection, so you can see which selections a client has spoken on.",
    risk: "read",
    available: sees("selection"),
    inputSchema: () => obj({ selection_id: str("Selection id (one thread)"), job: str("Job id, number or name (summary for every selection)") }),
    run: async (a) => {
      if (s(a.selection_id)) {
        const sel = await selectionJob(s(a.selection_id));
        const { comments } = await listComments(sel.id, sel.jobId);
        return { result: { selection: sel.name, comments } };
      }
      const job = await resolveJobId(a.job);
      const { data: rows } = await sb().from("project_selections").select("id, name, job_id, client_comments, client_comments_imported_at, client_rejected_at, client_approved_at, updated_at").eq("job_id", job.id);
      const summaries = await commentSummaries(job.id, (rows ?? []) as never);
      const names = new Map((rows ?? []).map((r) => [r.id as string, r.name as string]));
      const list = Object.entries(summaries).filter(([, v]) => (v as { count?: number }).count).map(([id, v]) => ({ selection_id: id, selection: names.get(id), ...(v as Json) }));
      return { result: { job: job.label, selections_with_comments: list } };
    },
  },
  {
    name: "cmi_selection_comment_reply",
    title: "Reply to a client on a selection",
    description: "Reply in a selection's comment thread. The client sees the reply in their portal and is notified. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => { const e = getEntity("selection"); return !!e && entityAllowed("selection", c.ctx) && jobWrite(c); },
    inputSchema: () => obj({ selection_id: str("Selection id"), body: str("The reply") }, ["selection_id", "body"]),
    preview: async (a): Promise<Preview> => {
      const sel = await selectionJob(s(a.selection_id));
      if (!sel.jobId) throw new Error("That selection isn't on a job, so there's no client to reply to.");
      if (!s(a.body)) throw new Error("Write the reply.");
      return { summary: `Reply to the client on "${sel.name}". They'll see it in the portal and be notified.`, details: { selection: sel.name, reply: s(a.body) }, entity: "selection", recordId: sel.id };
    },
    execute: async (a, c) => {
      const sel = await selectionJob(s(a.selection_id));
      const reply = await addStaffReply(sel.id, sel.jobId as string, staffOf(c), s(a.body));
      return { result: { replied: true, selection: sel.name, comment: reply }, entity: "selection", recordId: sel.id, before: null, after: reply };
    },
  },
  {
    name: "cmi_selection_comment_handled",
    title: "Mark a client comment handled",
    description: "Mark a client's selection comment as handled (or not), which clears it from the \"needs reply\" counts.",
    risk: "write",
    available: (c) => sees("selection")(c) && jobWrite(c),
    inputSchema: () => obj({ selection_id: str("Selection id"), comment_id: str("Comment id"), handled: bool("true = handled (default), false = reopen") }, ["selection_id", "comment_id"]),
    run: async (a, c) => {
      const out = await setHandled(s(a.selection_id), s(a.comment_id), c.ctx.id, a.handled !== false);
      return { result: { comment: out }, entity: "selection", recordId: s(a.selection_id), after: out };
    },
  },
];

// ─── Client activity ─────────────────────────────────────────────────────────

const activityTools: McpTool[] = [
  {
    name: "cmi_job_client_activity",
    title: "Client activity on a job",
    description: "Everything the client sent on a job, newest first: selection comments and decisions, portal messages, texts and emails from them, warranty requests, action items they finished, canvas briefs. Items still waiting on us are flagged needs-reply.",
    risk: "read",
    available: sees("job"),
    inputSchema: () => obj({ job: str("Job id, number or name"), limit: { type: "integer", minimum: 1, maximum: 200 } }, ["job"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      const feed = await loadClientFeed(job.id, { limit: typeof a.limit === "number" ? a.limit : 50 });
      return { result: { job: job.label, ...(feed as unknown as Json) } };
    },
  },
];

// ─── Job team: staff and clients ─────────────────────────────────────────────

const PERMISSION_HELP = "Client portal permissions (true/false): pm_phone, locked_selections, schedule_phases, schedule_items, change_order_requests, warranty_claims, messages, files, photos, and the financial ones shown in Job Info → Clients.";

const teamTools: McpTool[] = [
  {
    name: "cmi_job_team",
    title: "Job team and clients",
    description: "The people on a job: internal staff (with their job role and whether they get notifications) and clients (primary, portal access, portal permissions). Use the row ids with cmi_job_team_save / cmi_job_team_remove.",
    risk: "read",
    available: sees("job"),
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: async (a) => {
      const ref = await resolveJobId(a.job);
      const job = await getJob(ref.id);
      if (!job) throw new Error("Job not found.");
      const j = job as unknown as Json;
      return { result: {
        job: ref.label,
        staff: ((j.internal_users as Json[]) ?? []).map((u) => ({ id: u.id, staff_user_id: u.staff_user_id, name: (u.user as Json | null)?.display_name ?? (u.user as Json | null)?.email, role: u.role, notifications: u.notifications_enabled })),
        clients: ((j.contacts as Json[]) ?? []).map((c) => ({ id: c.id, contact_id: c.contact_id, name: `${(c.contact as Json | null)?.first_name ?? ""} ${(c.contact as Json | null)?.last_name ?? ""}`.trim(), email: (c.contact as Json | null)?.email, role: c.role, primary: c.is_primary, portal_access: c.portal_access_enabled, permissions: c.permissions })),
      } };
    },
  },
  {
    name: "cmi_job_team_save",
    title: "Add or update someone on a job",
    description: `Add a staff member (kind "staff": staff email or id, role e.g. "Project Manager", "Superintendent") or a client (kind "client": contact_id) to a job, or update an existing row (row_id from cmi_job_team). Added staff are notified. Turning a client's portal access on or changing what they can see is client-facing, so use cmi_job_portal_settings / cmi_job_client_invite for access; here you can set role, primary and permissions. ${PERMISSION_HELP}`,
    risk: "write",
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({
      job: str("Job id, number or name"), kind: { type: "string", enum: ["staff", "client"] }, row_id: str("Existing row id to update"),
      staff: str("Staff email or id (kind staff)"), contact_id: str("Contact id (kind client)"), role: str("Role on the job"),
      notifications: bool("Staff: get notifications for this job"), primary: bool("Client: the primary client"),
      permissions: { type: "object", additionalProperties: { type: "boolean" }, description: PERMISSION_HELP },
    }, ["job", "kind"]),
    run: async (a, c) => {
      const job = await resolveJobId(a.job);
      if (a.kind === "staff") {
        if (s(a.row_id)) {
          const patch: Json = {};
          if (s(a.role)) patch.role = s(a.role);
          if (typeof a.notifications === "boolean") patch.notifications_enabled = a.notifications;
          const row = await updateJobInternalUser(s(a.row_id), patch);
          return { result: { updated: row }, entity: "job_internal_user", recordId: row.id, after: row };
        }
        const staffId = await staffIdFor(a.staff);
        if (!staffId) throw new Error("Which staff member? Give their email or id.");
        const row = await addJobInternalUser(job.id, { staff_user_id: staffId, role: s(a.role) || null, notifications_enabled: a.notifications !== false }, c.ctx.id);
        return { result: { added: row, job: job.label }, entity: "job_internal_user", recordId: row.id, after: row };
      }
      if (a.permissions && Object.values(a.permissions as Json).some((v) => v === true) && !s(a.row_id)) {
        // New clients start with the portal's default permissions; widen them after adding.
      }
      if (s(a.row_id)) {
        const patch: Json = {};
        if (s(a.role)) patch.role = s(a.role);
        if (typeof a.primary === "boolean") patch.is_primary = a.primary;
        if (a.permissions && typeof a.permissions === "object") patch.permissions = a.permissions;
        const row = await updateJobContact(s(a.row_id), patch);
        return { result: { updated: row }, entity: "job_contact", recordId: row.id, after: row };
      }
      if (!s(a.contact_id)) throw new Error("Which client? Give contact_id (cmi_contacts_search).");
      const row = await addJobContact(job.id, { contact_id: s(a.contact_id), role: s(a.role) || "client", is_primary: a.primary === true });
      return { result: { added: row, job: job.label }, entity: "job_contact", recordId: row.id, after: row };
    },
  },
  {
    name: "cmi_job_team_remove",
    title: "Remove someone from a job",
    description: "Take a staff member or client off a job (row_id from cmi_job_team). Their own record isn't deleted. Previews first; runs with cmi_confirm.",
    risk: "high",
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({ kind: { type: "string", enum: ["staff", "client"] }, row_id: str("Row id from cmi_job_team") }, ["kind", "row_id"]),
    preview: async (a): Promise<Preview> => {
      const table = a.kind === "staff" ? "job_internal_users" : "job_contacts";
      const { data } = await sb().from(table).select("id, job_id").eq("id", s(a.row_id)).maybeSingle();
      if (!data) throw new Error("No such row on a job.");
      return { summary: `Remove this ${a.kind === "staff" ? "staff member" : "client"} from the job.`, entity: table, recordId: s(a.row_id) };
    },
    execute: async (a) => {
      if (a.kind === "staff") await removeJobInternalUser(s(a.row_id)); else await removeJobContact(s(a.row_id));
      return { result: { removed: true }, entity: a.kind === "staff" ? "job_internal_user" : "job_contact", recordId: s(a.row_id), after: null };
    },
  },
];

// ─── Client portal ───────────────────────────────────────────────────────────

const PORTAL_FIELDS = ["client_portal_enabled", "progress_percentage", "current_phase", "next_milestone", "client_description", "cover_image_url"] as const;

const portalTools: McpTool[] = [
  {
    name: "cmi_job_portal_settings",
    title: "Client portal settings",
    description: "Read a job's client portal settings (no changes), or change them: client_portal_enabled, progress_percentage (0-100), current_phase, next_milestone, client_description, cover_image_url. Clients see these, so a change previews first and runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({ job: str("Job id, number or name"), changes: { type: "object", additionalProperties: true, description: PORTAL_FIELDS.join(", ") } }, ["job", "changes"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      const ch = (a.changes as Json) ?? {};
      const bad = Object.keys(ch).filter((k) => !(PORTAL_FIELDS as readonly string[]).includes(k));
      if (bad.length) throw new Error(`Not a portal setting: ${bad.join(", ")}.`);
      if (!Object.keys(ch).length) throw new Error("Nothing to change.");
      return { summary: `Change the client portal for ${job.label}${ch.client_portal_enabled === true ? " and turn it on" : ""}. The client will see these.`, details: ch, entity: "job", recordId: job.id };
    },
    execute: async (a, c) => {
      const job = await resolveJobId(a.job);
      const ch = Object.fromEntries(Object.entries((a.changes as Json) ?? {}).filter(([k]) => (PORTAL_FIELDS as readonly string[]).includes(k)));
      const after = await updateJob(job.id, ch as never, { id: c.ctx.id, name: c.ctx.displayName });
      return { result: { updated: true, job: job.label, changes: ch }, entity: "job", recordId: job.id, after };
    },
  },
  {
    name: "cmi_job_client_invite",
    title: "Invite a client to the portal",
    description: "Email a job's client their portal invite (a set-account link) and turn on their portal access. client_row_id comes from cmi_job_team. Held (not sent) outside production. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({ job: str("Job id, number or name"), client_row_id: str("Client row id from cmi_job_team") }, ["job", "client_row_id"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      const { data } = await sb().from("job_contacts").select("id, contact:contacts(first_name, last_name, email)").eq("id", s(a.client_row_id)).eq("job_id", job.id).maybeSingle();
      const ct = (data as { contact: { first_name?: string; last_name?: string; email?: string } | null } | null)?.contact;
      if (!ct?.email) throw new Error("That client has no email on file.");
      return { summary: `Email ${`${ct.first_name ?? ""} ${ct.last_name ?? ""}`.trim() || ct.email} (${ct.email}) a portal invite for ${job.label}, and turn on their portal access.`, entity: "job_contact", recordId: s(a.client_row_id) };
    },
    execute: async (a) => {
      const job = await resolveJobId(a.job);
      const { data } = await sb().from("job_contacts").select("id, contact:contacts(first_name, email)").eq("id", s(a.client_row_id)).eq("job_id", job.id).maybeSingle();
      const ct = (data as { contact: { first_name?: string; email?: string } | null } | null)?.contact;
      if (!ct?.email) throw new Error("That client has no email on file.");
      await sb().from("job_contacts").update({ portal_access_enabled: true }).eq("id", s(a.client_row_id));
      await sb().from("jobs").update({ client_portal_enabled: true }).eq("id", job.id);
      if (!canSendOutbound()) return { result: { held: true, note: "Portal access is on; the invite email was held because this isn't production.", email: ct.email }, entity: "job_contact", recordId: s(a.client_row_id) };
      const { data: jn } = await sb().from("jobs").select("job_name").eq("id", job.id).maybeSingle();
      const r = await sendClientInvite({ email: ct.email, firstName: ct.first_name ?? "", jobName: (jn?.job_name as string) ?? "your project" });
      if (!r.ok) throw new Error(r.error ?? "The invite didn't send.");
      return { result: { invited: ct.email, job: job.label }, entity: "job_contact", recordId: s(a.client_row_id), capGroup: "email" };
    },
  },
  {
    name: "cmi_job_files_share",
    title: "Share job files with the client",
    description: "Show (or hide) job files in the client's portal. File ids come from cmi_list_files or cmi_job_files. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => sees("job_file")(c) && jobWrite(c),
    inputSchema: () => obj({ job: str("Job id, number or name"), file_ids: strList("Job file ids"), visible: bool("true = share with the client (default), false = hide") }, ["job", "file_ids"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      const want = ids(a.file_ids);
      const files = (await loadJobFiles(job.id)).filter((f) => want.includes(f.id));
      if (!files.length) throw new Error("None of those files are on this job.");
      return { summary: `${a.visible === false ? "Hide" : "Share"} ${files.length} file${files.length === 1 ? "" : "s"} ${a.visible === false ? "from" : "with"} the client on ${job.label}.`, details: { files: files.map((f) => (f as unknown as Json).name ?? f.id) }, entity: "job_file" };
    },
    execute: async (a) => {
      const job = await resolveJobId(a.job);
      const out = await setJobFilesClientVisible(job.id, ids(a.file_ids), a.visible !== false);
      return { result: { changed: out.length, visible: a.visible !== false }, entity: "job_file", after: out };
    },
  },
  {
    name: "cmi_job_files",
    title: "Job files",
    description: "List a job's files (Files tab), with whether each is shared with the client.",
    risk: "read",
    available: sees("job_file"),
    inputSchema: () => obj({ job: str("Job id, number or name") }, ["job"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      return { result: { job: job.label, files: await loadJobFiles(job.id) } };
    },
  },
];

// ─── Photos ──────────────────────────────────────────────────────────────────

const photoTools: McpTool[] = [
  {
    name: "cmi_job_photos",
    title: "Job photos",
    description: "A job's photo library, with optional filters (from / to dates, area, trade, tag, source, client_ok), plus the areas, trades and tags in use.",
    risk: "read",
    available: sees("job"),
    inputSchema: () => obj({ job: str("Job id, number or name"), from: str("YYYY-MM-DD"), to: str("YYYY-MM-DD"), area: str("Area"), trade: str("Trade"), tag: str("Tag"), source: str("Source"), client_ok: bool("Only photos shared with the client") }, ["job"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      const [photos, facets] = await Promise.all([
        listPhotos(job.id, { from: s(a.from) || null, to: s(a.to) || null, area: s(a.area) || null, trade: s(a.trade) || null, tag: s(a.tag) || null, source: s(a.source) || null, clientOk: typeof a.client_ok === "boolean" ? a.client_ok : null }),
        photoFacets(job.id),
      ]);
      return { result: { job: job.label, count: photos.length, photos: photos.slice(0, 200), ...facets } };
    },
  },
  {
    name: "cmi_job_photos_update",
    title: "Tag job photos",
    description: "Set area, trade, tags or caption on job photos (ids from cmi_job_photos). To show photos to the client use cmi_job_photos_share.",
    risk: "write",
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({ job: str("Job id, number or name"), photo_ids: strList("Photo ids"), area: str("Area"), trade: str("Trade"), tags: strList("Tags"), caption: str("Caption") }, ["job", "photo_ids"]),
    run: async (a) => {
      const job = await resolveJobId(a.job);
      const patch: Json = {};
      for (const k of ["area", "trade", "caption"]) if (s(a[k])) patch[k] = s(a[k]);
      if (Array.isArray(a.tags)) patch.tags = ids(a.tags);
      if (!Object.keys(patch).length) throw new Error("Nothing to change.");
      const out = await updatePhotos(job.id, ids(a.photo_ids), patch);
      return { result: { updated: out.length }, entity: "job_photo", after: out };
    },
  },
  {
    name: "cmi_job_photos_share",
    title: "Share job photos with the client",
    description: "Mark job photos Client OK (they show in the client's portal) or take that off. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: (c) => sees("job")(c) && jobWrite(c),
    inputSchema: () => obj({ job: str("Job id, number or name"), photo_ids: strList("Photo ids"), visible: bool("true = share (default), false = hide") }, ["job", "photo_ids"]),
    preview: async (a): Promise<Preview> => {
      const job = await resolveJobId(a.job);
      const n = ids(a.photo_ids).length;
      if (!n) throw new Error("Which photos?");
      return { summary: `${a.visible === false ? "Hide" : "Share"} ${n} photo${n === 1 ? "" : "s"} ${a.visible === false ? "from" : "with"} the client on ${job.label}.`, entity: "job_photo" };
    },
    execute: async (a) => {
      const job = await resolveJobId(a.job);
      const out = await updatePhotos(job.id, ids(a.photo_ids), { client_ok: a.visible !== false });
      return { result: { changed: out.length, client_ok: a.visible !== false }, entity: "job_photo", after: out };
    },
  },
];

export function clientTools(): McpTool[] {
  return [...commentTools, ...activityTools, ...teamTools, ...portalTools, ...photoTools];
}
