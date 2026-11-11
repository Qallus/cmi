// Everything a job's client sent the team, in one list (the job's Client
// activity: the Activity tab and the floating button on every job page).
// Each source is read on its own so one missing table never hides the rest.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildFeed, unansweredInbound, type CommRow, type FeedItem } from "./client-feed-core";

export type ClientFeed = ReturnType<typeof buildFeed>;
type ContactRow = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null };

const clip = (s: string | null | undefined, n = 280) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);
const nameOf = (c: { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null } | null | undefined) =>
  (c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email : null) || "Client";

async function safe<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try { return await run(); } catch (e) { console.error(`[client-feed] ${label}`, e); return []; }
}

export async function loadClientFeed(jobId: string, opts: { limit?: number } = {}): Promise<ClientFeed> {
  const sb = getSupabaseAdmin();
  const limit = opts.limit ?? 60;
  const sel = `/dashboard/jobs/${jobId}/selections`;

  const clientIds = await safe("contacts", async () => {
    const { data } = await sb.from("job_contacts").select("contact_id").eq("job_id", jobId);
    return ((data ?? []) as { contact_id: string | null }[]).map((r) => r.contact_id).filter((x): x is string => !!x);
  });
  const contactNames = new Map<string, string>();
  if (clientIds.length) {
    const { data } = await sb.from("contacts").select("id, first_name, last_name, company, email").in("id", clientIds);
    for (const c of (data ?? []) as ContactRow[]) contactNames.set(c.id, nameOf(c));
  }

  const [selections, dms, comms, warranty, actions, canvas] = await Promise.all([
    // Selection comments and decisions (the client's side of each thread).
    safe("selections", async () => {
      const { data, error } = await sb.from("selection_comments")
        .select("id, selection_id, author_name, action, body:comment_body, created_at, handled_at, selection:project_selections(name)")
        .eq("job_id", jobId).eq("author_kind", "client").order("created_at", { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as { id: string; selection_id: string; author_name: string | null; action: string; body: string | null; created_at: string; handled_at: string | null; selection: { name: string | null } | null }[])
        .map((r): FeedItem => ({
          id: `sel:${r.id}`, kind: "selection", at: r.created_at, who: r.author_name ?? "Client",
          title: `${r.action === "approved" ? "Approved" : r.action === "rejected" ? "Did not approve" : r.action === "revision_requested" ? "Asked for a change to" : "Commented on"} ${r.selection?.name ?? "a selection"}`,
          body: clip(r.body), href: `${sel}?sel=${r.selection_id}&comments=1`, open: !r.handled_at,
        }));
    }),
    // Client ↔ team messages on this job; open when the client spoke last.
    safe("messages", async () => {
      const { data: convos } = await sb.from("dm_conversations").select("id, last_sender_kind").eq("job_id", jobId);
      const list = (convos ?? []) as { id: string; last_sender_kind: string | null }[];
      if (!list.length) return [];
      const { data } = await sb.from("dm_messages").select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", list.map((c) => c.id)).eq("sender_kind", "client").order("created_at", { ascending: false }).limit(limit);
      const rows = (data ?? []) as { id: string; conversation_id: string; sender_id: string; body: string | null; created_at: string }[];
      const latest = new Map<string, string>();
      for (const r of rows) if (!latest.has(r.conversation_id)) latest.set(r.conversation_id, r.id);
      const clientLast = new Set(list.filter((c) => c.last_sender_kind === "client").map((c) => c.id));
      const missing = [...new Set(rows.map((r) => r.sender_id))].filter((id) => !contactNames.has(id));
      if (missing.length) {
        const { data: cs } = await sb.from("contacts").select("id, first_name, last_name, company, email").in("id", missing);
        for (const c of (cs ?? []) as ContactRow[]) contactNames.set(c.id, nameOf(c));
      }
      return rows.map((r): FeedItem => ({
        id: `dm:${r.id}`, kind: "message", at: r.created_at, who: contactNames.get(r.sender_id) ?? "Client",
        title: "Sent a message", body: clip(r.body) ?? "Attachment", href: `/dashboard/jobs/${jobId}/messages`,
        open: clientLast.has(r.conversation_id) && latest.get(r.conversation_id) === r.id,
      }));
    }),
    // Texts and emails from the job's clients.
    safe("communications", async () => {
      if (!clientIds.length) return [];
      const { data } = await sb.from("messages").select("id, direction, channel, contact_id, subject, body, created_at")
        .in("contact_id", clientIds).in("channel", ["sms", "email"]).order("created_at", { ascending: false }).limit(200);
      const rows = (data ?? []) as (CommRow & { subject: string | null; body: string | null })[];
      const open = unansweredInbound(rows);
      return rows.filter((r) => r.direction === "inbound").slice(0, limit).map((r): FeedItem => ({
        id: `msg:${r.id}`, kind: r.channel === "sms" ? "sms" : "email", at: r.created_at, who: (r.contact_id && contactNames.get(r.contact_id)) || "Client",
        title: r.channel === "sms" ? "Sent a text" : r.subject ? `Emailed: ${r.subject}` : "Sent an email",
        body: clip(r.body), href: `/dashboard/jobs/${jobId}/communications`, open: open.has(r.id),
      }));
    }),
    safe("warranty", async () => {
      const { data } = await sb.from("warranty_requests").select("id, submitted_by, request_title, request_description, status, created_at")
        .eq("job_id", jobId).order("created_at", { ascending: false }).limit(limit);
      return ((data ?? []) as { id: string; submitted_by: string | null; request_title: string | null; request_description: string | null; status: string | null; created_at: string }[])
        .map((r): FeedItem => ({
          id: `war:${r.id}`, kind: "warranty", at: r.created_at, who: r.submitted_by ?? "Client",
          title: `Warranty request: ${r.request_title ?? "untitled"}`, body: clip(r.request_description),
          href: `/dashboard/jobs/${jobId}/activity`, open: (r.status ?? "submitted") === "submitted",
        }));
    }),
    safe("action items", async () => {
      const { data } = await sb.from("job_action_items").select("id, title, assigned_contact_id, completed_at")
        .eq("job_id", jobId).eq("status", "completed").not("assigned_contact_id", "is", null).not("completed_at", "is", null)
        .order("completed_at", { ascending: false }).limit(limit);
      return ((data ?? []) as { id: string; title: string | null; assigned_contact_id: string; completed_at: string }[])
        .map((r): FeedItem => ({
          id: `act:${r.id}`, kind: "action_item", at: r.completed_at, who: contactNames.get(r.assigned_contact_id) ?? "Client",
          title: `Finished "${r.title ?? "an action item"}"`, body: null, href: `/dashboard/jobs/${jobId}/client-portal`, open: false,
        }));
    }),
    safe("canvas", async () => {
      const { data } = await sb.from("canvas_projects").select("id, title, status, submitted_at").eq("job_id", jobId).not("submitted_at", "is", null).limit(limit);
      return ((data ?? []) as { id: string; title: string | null; status: string | null; submitted_at: string }[])
        .map((r): FeedItem => ({
          id: `can:${r.id}`, kind: "canvas", at: r.submitted_at, who: "Client",
          title: `Submitted the Project Canvas brief "${r.title ?? "Untitled"}"`, body: null,
          href: `/dashboard/canvas-briefs/${r.id}`, open: r.status === "submitted",
        }));
    }),
  ]);

  return buildFeed([...selections, ...dms, ...comms, ...warranty, ...actions, ...canvas]);
}
