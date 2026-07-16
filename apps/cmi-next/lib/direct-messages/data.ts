import { getSupabaseAdmin } from "@/lib/supabase/server";

// Direct Messages data layer (service-role; the API authorizes the requester as
// a participant). Participants/senders are polymorphic — a "party" is a
// staff_users row (kind "staff") or a contacts row (kind "client"). Ids are
// unique across those tables, so the unread RPCs (keyed on the party id) work
// for both. `userId` params below are the current party's id.

export type DmImportance = "normal" | "important" | "urgent";
export type DmPartyKind = "staff" | "client";
export type DmParty = { id: string; kind: DmPartyKind };
export type DmPerson = { id: string; name: string; email: string };
export type DmConversationSummary = {
  id: string;
  other: DmPerson | null;
  job_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  unread: number;
};
export type DmMessage = {
  id: string;
  sender_id: string | null;
  body: string;
  importance: DmImportance;
  attachments: unknown[];
  created_at: string;
  mine: boolean;
};

function staffName(p: { display_name?: string | null; email?: string | null }): string {
  return (p.display_name ?? "").trim() || (p.email ?? "Unknown");
}
function contactName(c: { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || (c.company ?? "").trim() || (c.email ?? "Client");
}

// Batch-resolve (id, kind) parties to display people from staff_users + contacts.
async function resolveParties(supabase: ReturnType<typeof getSupabaseAdmin>, parties: DmParty[]): Promise<Map<string, DmPerson>> {
  const map = new Map<string, DmPerson>();
  const staffIds = [...new Set(parties.filter((p) => p.kind === "staff").map((p) => p.id))];
  const clientIds = [...new Set(parties.filter((p) => p.kind === "client").map((p) => p.id))];
  if (staffIds.length) {
    const { data } = await supabase.from("staff_users").select("id, display_name, email").in("id", staffIds);
    for (const r of data ?? []) map.set(r.id, { id: r.id, name: staffName(r), email: r.email ?? "" });
  }
  if (clientIds.length) {
    const { data } = await supabase.from("contacts").select("id, first_name, last_name, company, email").in("id", clientIds);
    for (const r of data ?? []) map.set(r.id, { id: r.id, name: contactName(r), email: r.email ?? "" });
  }
  return map;
}

export async function listConversations(
  userId: string,
  filter?: { search?: string; from?: string; to?: string; jobId?: string },
): Promise<DmConversationSummary[]> {
  const supabase = getSupabaseAdmin();

  const { data: mine } = await supabase.from("dm_participants").select("conversation_id").eq("user_id", userId);
  const convIds = (mine ?? []).map((r) => r.conversation_id);
  if (!convIds.length) return [];

  let convQuery = supabase
    .from("dm_conversations")
    .select("id, job_id, last_message_at, last_message_preview, last_sender_id")
    .in("id", convIds)
    .eq("status", "active")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (filter?.from) convQuery = convQuery.gte("last_message_at", filter.from);
  if (filter?.to) convQuery = convQuery.lte("last_message_at", filter.to);
  if (filter?.jobId) convQuery = convQuery.eq("job_id", filter.jobId);
  const { data: convos } = await convQuery;
  if (!convos?.length) return [];

  const ids = convos.map((c) => c.id);
  const { data: others } = await supabase
    .from("dm_participants")
    .select("conversation_id, user_id, user_kind")
    .in("conversation_id", ids)
    .neq("user_id", userId);
  const otherRows = (others ?? []) as { conversation_id: string; user_id: string; user_kind: DmPartyKind }[];
  const peopleMap = await resolveParties(supabase, otherRows.map((r) => ({ id: r.user_id, kind: r.user_kind })));
  const otherByConv = new Map<string, DmPerson>();
  for (const row of otherRows) {
    const person = peopleMap.get(row.user_id);
    if (person) otherByConv.set(row.conversation_id, person);
  }

  const unreadByConv = new Map<string, number>();
  const { data: unreadRows } = await supabase.rpc("dm_conversation_unread", { p_user: userId });
  for (const r of (unreadRows ?? []) as { conversation_id: string; unread: number }[]) unreadByConv.set(r.conversation_id, r.unread);

  let list: DmConversationSummary[] = convos.map((c) => ({
    id: c.id,
    other: otherByConv.get(c.id) ?? null,
    job_id: c.job_id,
    last_message_at: c.last_message_at,
    last_message_preview: c.last_message_preview,
    last_sender_id: c.last_sender_id,
    unread: unreadByConv.get(c.id) ?? 0,
  }));

  const q = filter?.search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.other?.name.toLowerCase().includes(q) ||
        c.other?.email.toLowerCase().includes(q) ||
        (c.last_message_preview ?? "").toLowerCase().includes(q),
    );
  }
  return list;
}

export async function isParticipant(userId: string, conversationId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("dm_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function getThread(userId: string, conversationId: string) {
  const supabase = getSupabaseAdmin();
  if (!(await isParticipant(userId, conversationId))) return null;

  const { data: messages } = await supabase
    .from("dm_messages")
    .select("id, sender_id, body, importance, attachments, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const { data: otherRow } = await supabase
    .from("dm_participants")
    .select("user_id, user_kind")
    .eq("conversation_id", conversationId)
    .neq("user_id", userId)
    .maybeSingle();
  let other: DmPerson | null = null;
  if (otherRow) {
    const map = await resolveParties(supabase, [{ id: otherRow.user_id, kind: otherRow.user_kind as DmPartyKind }]);
    other = map.get(otherRow.user_id) ?? null;
  }

  await supabase
    .from("dm_participants")
    .update({ last_read_at: new Date().toISOString(), last_notified_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  const thread: DmMessage[] = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    importance: (m.importance as DmImportance) ?? "normal",
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
    created_at: m.created_at,
    mine: m.sender_id === userId,
  }));
  return { conversation: { id: conversationId, other }, messages: thread };
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { body: string; importance?: DmImportance; attachments?: unknown[] },
  senderKind: DmPartyKind = "staff",
) {
  const supabase = getSupabaseAdmin();
  if (!(await isParticipant(userId, conversationId))) throw new Error("You are not a participant in this conversation.");
  const body = input.body.trim();
  const attachments = input.attachments ?? [];
  if (!body && !attachments.length) throw new Error("Message is empty.");

  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: userId, sender_kind: senderKind, body, importance: input.importance ?? "normal", attachments })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const preview = body ? body.slice(0, 140) : "📎 Attachment";
  await supabase
    .from("dm_conversations")
    .update({ last_message_at: message.created_at, last_message_preview: preview, last_sender_id: userId, last_sender_kind: senderKind, updated_at: message.created_at })
    .eq("id", conversationId);
  await supabase.from("dm_participants").update({ last_read_at: message.created_at }).eq("conversation_id", conversationId).eq("user_id", userId);

  return { id: message.id, created_at: message.created_at };
}

/** Find or create a 1:1 conversation between two parties (optionally job-scoped). */
export async function findOrCreateConversation(creator: DmParty, other: DmParty, jobId?: string | null): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (creator.id === other.id) throw new Error("You cannot message yourself.");

  const { data: mine } = await supabase.from("dm_participants").select("conversation_id").eq("user_id", creator.id);
  const myIds = (mine ?? []).map((r) => r.conversation_id);
  if (myIds.length) {
    const { data: shared } = await supabase.from("dm_participants").select("conversation_id").eq("user_id", other.id).in("conversation_id", myIds);
    const candidateIds = (shared ?? []).map((r) => r.conversation_id);
    if (candidateIds.length) {
      if (jobId) {
        const { data: onJob } = await supabase.from("dm_conversations").select("id").in("id", candidateIds).eq("job_id", jobId).limit(1);
        if (onJob?.length) return onJob[0].id;
      } else {
        return candidateIds[0];
      }
    }
  }

  const { data: conv, error } = await supabase
    .from("dm_conversations")
    .insert({ created_by: creator.id, job_id: jobId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("dm_participants").insert([
    { conversation_id: conv.id, user_id: creator.id, user_kind: creator.kind },
    { conversation_id: conv.id, user_id: other.id, user_kind: other.kind },
  ]);
  return conv.id;
}

/** Active staff the user can start a DM with (everyone but themselves). */
export async function listMessageableUsers(userId: string, search?: string): Promise<DmPerson[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("staff_users")
    .select("id, display_name, email, status")
    .neq("id", userId)
    .order("display_name", { ascending: true })
    .limit(50);
  const q = search?.trim();
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data } = await query;
  return (data ?? [])
    .filter((p) => (p.status ?? "active") !== "disabled" && (p.status ?? "active") !== "inactive")
    .map((p) => ({ id: p.id, name: staffName(p), email: p.email ?? "" }));
}

/** Total unread messages for a party (powers the bell / portal badge). */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.rpc("dm_unread_count", { p_user: userId });
  return typeof data === "number" ? data : 0;
}

// ── Client↔PM helpers ────────────────────────────────────────────────────────

/** The staff member a client should message about a job (their PM / team lead). */
export async function getJobPrimaryPm(jobId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("job_internal_users").select("staff_user_id, role").eq("job_id", jobId);
  const rows = (data ?? []).filter((r) => r.staff_user_id) as { staff_user_id: string; role: string | null }[];
  if (!rows.length) return null;
  const pm = rows.find((r) => /manager|pm|superintendent|lead/i.test(r.role ?? ""));
  return (pm ?? rows[0]).staff_user_id;
}

/** Find or create the client↔PM conversation for a job. */
export async function findOrCreateClientPmConversation(contactId: string, jobId: string): Promise<string> {
  const pmId = await getJobPrimaryPm(jobId);
  if (!pmId) throw new Error("No project team member is assigned to this job yet.");
  return findOrCreateConversation({ id: contactId, kind: "client" }, { id: pmId, kind: "staff" }, jobId);
}
