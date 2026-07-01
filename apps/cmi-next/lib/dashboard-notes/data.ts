// Dashboard Review Notes — data access (service-role; caller enforces role).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CreateNoteInput, DashboardNote } from "./types";

export async function createNote(input: CreateNoteInput, author: { email: string; name: string }): Promise<DashboardNote> {
  const sb = getSupabaseAdmin();
  const recipients = Array.from(new Set(input.recipient_emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const { data, error } = await sb
    .from("dashboard_notes")
    .insert({
      route: input.route,
      page_title: input.page_title,
      note: input.note,
      type: input.type,
      priority: input.priority,
      created_by: author.email.toLowerCase(),
      created_by_name: author.name,
      recipient_emails: recipients,
      screenshot_url: input.screenshot_url,
      shared: recipients.length > 0,
      read_by: [author.email.toLowerCase()],
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as DashboardNote;
}

/** Notes shared with `email` (as a recipient). Newest first. */
export async function listSharedWith(email: string): Promise<DashboardNote[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("dashboard_notes")
    .select("*")
    .contains("recipient_emails", [email.toLowerCase()])
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardNote[];
}

/** Notes relevant to this user: ones they created OR ones shared with them. */
export async function listInbox(email: string): Promise<DashboardNote[]> {
  const sb = getSupabaseAdmin();
  const lower = email.toLowerCase();
  const [mine, shared] = await Promise.all([
    sb.from("dashboard_notes").select("*").eq("created_by", lower).neq("status", "archived").order("created_at", { ascending: false }).limit(100),
    sb.from("dashboard_notes").select("*").contains("recipient_emails", [lower]).neq("status", "archived").order("created_at", { ascending: false }).limit(100),
  ]);
  const byId = new Map<string, DashboardNote>();
  for (const n of [...(mine.data ?? []), ...(shared.data ?? [])] as DashboardNote[]) byId.set(n.id, n);
  return Array.from(byId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** Full backlog (all notes) for the inbox view. */
export async function listAll(): Promise<DashboardNote[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("dashboard_notes").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardNote[];
}

export async function updateNote(id: string, patch: Partial<Pick<DashboardNote, "status">>): Promise<DashboardNote> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("dashboard_notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as DashboardNote;
}

/** Add `email` to read_by so it stops counting as unread on the bell. */
export async function markRead(id: string, email: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("dashboard_notes").select("read_by").eq("id", id).maybeSingle();
  const readBy = new Set<string>(((data?.read_by as string[]) ?? []).map((e) => e.toLowerCase()));
  readBy.add(email.toLowerCase());
  await sb.from("dashboard_notes").update({ read_by: Array.from(readBy) }).eq("id", id);
}

/** Count of shared notes this user hasn't read yet — feeds the notification bell. */
export async function unreadCountFor(email: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const lower = email.toLowerCase();
  const { data, error } = await sb
    .from("dashboard_notes")
    .select("read_by")
    .contains("recipient_emails", [lower])
    .neq("status", "archived");
  if (error) return 0;
  return (data ?? []).filter((r) => !((r.read_by as string[]) ?? []).map((e) => e.toLowerCase()).includes(lower)).length;
}
