// The commitments register: promises and follow-ups across CMI ("I'll send the
// revised bid Friday", "waiting on the sub for the COI"), kept until resolved
// with evidence. Created from the dashboard, Claude (MCP) or Bolt; each one
// can point back to the email, meeting or chat it came from. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyStaff } from "@/lib/notifications/dispatch";

export const WAITING_ON = ["none", "client", "sub", "teammate", "vendor"] as const;
export const COMMITMENT_SOURCES = ["email", "sms", "meeting", "slack", "call", "manual"] as const;
export const COMMITMENT_STATUSES = ["open", "done", "dismissed"] as const;

export type Commitment = {
  id: string;
  title: string;
  details: string | null;
  owner_staff_id: string | null;
  waiting_on: (typeof WAITING_ON)[number];
  waiting_on_contact_id: string | null;
  waiting_on_staff_id: string | null;
  job_id: string | null;
  deal_id: string | null;
  opportunity_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  source: (typeof COMMITMENT_SOURCES)[number];
  source_link: string | null;
  source_ref: string | null;
  due_on: string | null;
  status: (typeof COMMITMENT_STATUSES)[number];
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_evidence: string | null;
  created_by: string | null;
  created_via: "dashboard" | "mcp" | "bolt";
  created_at: string;
  updated_at: string;
};

export type CommitmentRow = Commitment & {
  owner_name: string | null;
  job_label: string | null;
  deal_label: string | null;
  contact_name: string | null;
  overdue: boolean;
};

export class CommitmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const EDITABLE = [
  "title", "details", "owner_staff_id", "waiting_on", "waiting_on_contact_id", "waiting_on_staff_id",
  "job_id", "deal_id", "opportunity_id", "contact_id", "company_id", "source", "source_link", "source_ref", "due_on",
] as const;

function clean(input: Record<string, unknown>): Partial<Commitment> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in input)) continue;
    const v = input[k];
    out[k] = typeof v === "string" ? (v.trim() || null) : v ?? null;
  }
  if (out.waiting_on != null && !(WAITING_ON as readonly string[]).includes(String(out.waiting_on))) throw new CommitmentError(`waiting_on must be one of: ${WAITING_ON.join(", ")}.`);
  if (out.source != null && !(COMMITMENT_SOURCES as readonly string[]).includes(String(out.source))) throw new CommitmentError(`source must be one of: ${COMMITMENT_SOURCES.join(", ")}.`);
  if (out.due_on != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(out.due_on))) throw new CommitmentError("due_on must be a date like 2026-11-05.");
  if (out.waiting_on === null) out.waiting_on = "none";
  return out as Partial<Commitment>;
}

export type CommitmentFilter = {
  ownerId?: string | null;
  /** Commitments where this person is the one we're waiting on. */
  waitingOnStaffId?: string | null;
  jobId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  status?: string | null;
  /** Only open items due more than this many days ago (or with no due date and older than it). */
  staleDays?: number | null;
  limit?: number;
};

export async function listCommitments(filter: CommitmentFilter = {}): Promise<CommitmentRow[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("commitments").select("*").order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    .limit(Math.min(filter.limit ?? 100, 500));
  if (filter.ownerId) q = q.eq("owner_staff_id", filter.ownerId);
  if (filter.waitingOnStaffId) q = q.eq("waiting_on_staff_id", filter.waitingOnStaffId);
  if (filter.jobId) q = q.eq("job_id", filter.jobId);
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.contactId) q = q.eq("contact_id", filter.contactId);
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  else if (!filter.status) q = q.eq("status", "open");
  if (filter.staleDays != null) {
    const cutoff = new Date(Date.now() - filter.staleDays * 86_400_000).toISOString().slice(0, 10);
    q = q.eq("status", "open").or(`due_on.lt.${cutoff},and(due_on.is.null,created_at.lt.${cutoff})`);
  }
  const { data, error } = await q;
  if (error) throw new CommitmentError(error.message, 500);
  return decorate((data ?? []) as Commitment[]);
}

export async function getCommitment(id: string): Promise<CommitmentRow | null> {
  const { data } = await getSupabaseAdmin().from("commitments").select("*").eq("id", id).maybeSingle();
  return data ? (await decorate([data as Commitment]))[0] : null;
}

/** Names for owners, jobs, deals and contacts, in four queries instead of one per row. */
async function decorate(rows: Commitment[]): Promise<CommitmentRow[]> {
  if (!rows.length) return [];
  const supabase = getSupabaseAdmin();
  const ids = (k: keyof Commitment) => [...new Set(rows.map((r) => r[k]).filter(Boolean) as string[])];
  const [staff, jobs, deals, contacts] = await Promise.all([
    ids("owner_staff_id").length ? supabase.from("staff_users").select("id, display_name, first_name, last_name, email").in("id", ids("owner_staff_id")) : { data: [] },
    ids("job_id").length ? supabase.from("jobs").select("id, job_number, job_name").in("id", ids("job_id")) : { data: [] },
    ids("deal_id").length ? supabase.from("deals").select("id, title").in("id", ids("deal_id")) : { data: [] },
    ids("contact_id").length ? supabase.from("contacts").select("id, first_name, last_name").in("id", ids("contact_id")) : { data: [] },
  ]);
  const m = <T extends { id: string }>(list: T[] | null | undefined) => new Map((list ?? []).map((x) => [x.id, x]));
  const s = m(staff.data as { id: string; display_name: string | null; first_name: string | null; last_name: string | null; email: string | null }[]);
  const j = m(jobs.data as { id: string; job_number: string | null; job_name: string | null }[]);
  const d = m(deals.data as { id: string; title: string | null }[]);
  const c = m(contacts.data as { id: string; first_name: string | null; last_name: string | null }[]);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const o = r.owner_staff_id ? s.get(r.owner_staff_id) : null;
    const jb = r.job_id ? j.get(r.job_id) : null;
    const ct = r.contact_id ? c.get(r.contact_id) : null;
    return {
      ...r,
      owner_name: o ? o.display_name || [o.first_name, o.last_name].filter(Boolean).join(" ") || o.email : null,
      job_label: jb ? (jb.job_number && jb.job_name && jb.job_number.includes(jb.job_name) ? jb.job_number : [jb.job_number, jb.job_name].filter(Boolean).join(" ")) : null,
      deal_label: r.deal_id ? d.get(r.deal_id)?.title ?? null : null,
      contact_name: ct ? [ct.first_name, ct.last_name].filter(Boolean).join(" ") : null,
      overdue: r.status === "open" && !!r.due_on && r.due_on < today,
    };
  });
}

export async function createCommitment(
  input: Record<string, unknown>, actor: { id: string }, via: Commitment["created_via"],
): Promise<{ commitment: CommitmentRow; created: boolean }> {
  const row = clean(input);
  if (!row.title) throw new CommitmentError("Give the commitment a short title (what was promised).");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("commitments").insert({
    ...row, owner_staff_id: row.owner_staff_id ?? actor.id, created_by: actor.id, created_via: via,
  }).select("*").single();
  if (error?.code === "23505" && row.source_ref) {
    // Already filed from this source: hand back the existing one.
    const { data: existing } = await supabase.from("commitments").select("*").eq("source_ref", row.source_ref).ilike("title", row.title).maybeSingle();
    if (existing) return { commitment: (await decorate([existing as Commitment]))[0], created: false };
  }
  if (error || !data) throw new CommitmentError(error?.message ?? "Couldn't save the commitment.", 500);
  const created = data as Commitment;
  if (created.owner_staff_id && created.owner_staff_id !== actor.id) await notifyOwner(created, actor.id, "assigned");
  return { commitment: (await decorate([created]))[0], created: true };
}

export async function updateCommitment(id: string, input: Record<string, unknown>, actor: { id: string }): Promise<{ before: Commitment; after: CommitmentRow }> {
  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from("commitments").select("*").eq("id", id).maybeSingle();
  if (!before) throw new CommitmentError("No commitment with that id.", 404);
  const patch = clean(input);
  if ("title" in patch && !patch.title) throw new CommitmentError("The title can't be empty.");
  const { data, error } = await supabase.from("commitments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) throw new CommitmentError(error?.message ?? "Couldn't update.", 500);
  const after = data as Commitment;
  if (patch.owner_staff_id && patch.owner_staff_id !== (before as Commitment).owner_staff_id) await notifyOwner(after, actor.id, "assigned");
  return { before: before as Commitment, after: (await decorate([after]))[0] };
}

/** Done needs evidence: a short note or a link showing it actually happened. */
export async function resolveCommitment(id: string, evidence: string, actor: { id: string }): Promise<{ before: Commitment; after: CommitmentRow }> {
  if (!evidence?.trim()) throw new CommitmentError("Add a short note or link showing it's done (e.g. 'sent revised bid 11/3').");
  return setStatus(id, "done", actor, evidence.trim());
}

export async function dismissCommitment(id: string, reason: string | null, actor: { id: string }) {
  return setStatus(id, "dismissed", actor, reason?.trim() || "Dismissed");
}

export async function reopenCommitment(id: string, actor: { id: string }) {
  return setStatus(id, "open", actor, null);
}

async function setStatus(id: string, status: Commitment["status"], actor: { id: string }, evidence: string | null) {
  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from("commitments").select("*").eq("id", id).maybeSingle();
  if (!before) throw new CommitmentError("No commitment with that id.", 404);
  const open = status === "open";
  const { data, error } = await supabase.from("commitments").update({
    status, resolved_by: open ? null : actor.id, resolved_at: open ? null : new Date().toISOString(),
    resolved_evidence: evidence, updated_at: new Date().toISOString(),
  }).eq("id", id).select("*").single();
  if (error || !data) throw new CommitmentError(error?.message ?? "Couldn't update.", 500);
  return { before: before as Commitment, after: (await decorate([data as Commitment]))[0] };
}

async function notifyOwner(c: Commitment, actorId: string, _why: "assigned") {
  if (!c.owner_staff_id) return;
  await notifyStaff({
    recipientIds: [c.owner_staff_id], actorId,
    kind: "commitment_assigned",
    title: `New commitment for you: ${c.title}`,
    body: c.due_on ? `Due ${c.due_on}.` : null,
    url: "/dashboard/commitments",
    sourceTable: "commitments", sourceId: c.id,
    dedupeKey: `commitment_assigned:${c.id}:${c.owner_staff_id}`,
  }).catch((err) => console.error("[commitments] notify failed", err));
}
