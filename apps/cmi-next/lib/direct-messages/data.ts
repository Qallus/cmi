import { getSupabaseAdmin } from "@/lib/supabase/server";

// Direct Messages data layer (service-role; the API authorizes the requester as
// a participant). Staff↔staff 1:1 today, group-ready. Adapted from the MJG DM
// model to CMI's staff_users. `userId` is a staff_users.id.

export type DmImportance = "normal" | "important" | "urgent";
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

type StaffRow = { id: string; display_name: string | null; email: string | null };
type EmbeddedStaff = StaffRow | StaffRow[] | null;

function personName(p: { display_name?: string | null; email?: string | null }): string {
  return (p.display_name ?? "").trim() || (p.email ?? "Unknown");
}
function pickStaff(embedded: EmbeddedStaff): StaffRow | null {
  if (!embedded) return null;
  return Array.isArray(embedded) ? embedded[0] ?? null : embedded;
}

/** Conversations the user is in, newest first, with unread counts. */
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
    .select("conversation_id, staff:user_id(id, display_name, email)")
    .in("conversation_id", ids)
    .neq("user_id", userId);
  const otherByConv = new Map<string, DmPerson>();
  for (const row of (others ?? []) as unknown as { conversation_id: string; staff: EmbeddedStaff }[]) {
    const p = pickStaff(row.staff);
    if (p) otherByConv.set(row.conversation_id, { id: p.id, name: personName(p), email: p.email ?? "" });
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

/** Full thread + the other participant; marks the conversation read for the user. */
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
    .select("staff:user_id(id, display_name, email)")
    .eq("conversation_id", conversationId)
    .neq("user_id", userId)
    .maybeSingle();
  const op = pickStaff((otherRow as unknown as { staff: EmbeddedStaff } | null)?.staff ?? null);
  const other: DmPerson | null = op ? { id: op.id, name: personName(op), email: op.email ?? "" } : null;

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
) {
  const supabase = getSupabaseAdmin();
  if (!(await isParticipant(userId, conversationId))) throw new Error("You are not a participant in this conversation.");
  const body = input.body.trim();
  const attachments = input.attachments ?? [];
  if (!body && !attachments.length) throw new Error("Message is empty.");

  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: userId, body, importance: input.importance ?? "normal", attachments })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const preview = body ? body.slice(0, 140) : "📎 Attachment";
  await supabase
    .from("dm_conversations")
    .update({ last_message_at: message.created_at, last_message_preview: preview, last_sender_id: userId, updated_at: message.created_at })
    .eq("id", conversationId);
  await supabase.from("dm_participants").update({ last_read_at: message.created_at }).eq("conversation_id", conversationId).eq("user_id", userId);

  return { id: message.id, created_at: message.created_at };
}

/** Find or create a 1:1 conversation between two staff (optionally job-scoped). */
export async function findOrCreateConversation(creatorId: string, otherUserId: string, jobId?: string | null): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (creatorId === otherUserId) throw new Error("You cannot message yourself.");

  const { data: mine } = await supabase.from("dm_participants").select("conversation_id").eq("user_id", creatorId);
  const myIds = (mine ?? []).map((r) => r.conversation_id);
  if (myIds.length) {
    const { data: shared } = await supabase.from("dm_participants").select("conversation_id").eq("user_id", otherUserId).in("conversation_id", myIds);
    const candidateIds = (shared ?? []).map((r) => r.conversation_id);
    if (candidateIds.length) {
      // If job-scoped, prefer a conversation on the same job; otherwise reuse any.
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
    .insert({ created_by: creatorId, job_id: jobId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("dm_participants").insert([
    { conversation_id: conv.id, user_id: creatorId },
    { conversation_id: conv.id, user_id: otherUserId },
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
    .map((p) => ({ id: p.id, name: personName(p), email: p.email ?? "" }));
}

/** Total unread messages for a user (powers the bell badge). */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.rpc("dm_unread_count", { p_user: userId });
  return typeof data === "number" ? data : 0;
}
