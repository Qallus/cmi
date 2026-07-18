// Super-Admin broadcast notifications. Targeting: all | staff | clients | role.
// Reads tracked in broadcast_reads (row = read); opt-out in notification_prefs.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type BroadcastAudience = "all" | "staff" | "clients" | "role";
export type UserKind = "staff" | "client";

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  audience: BroadcastAudience;
  target_role: string | null;
  created_by_name: string | null;
  created_at: string;
};

export async function createBroadcast(input: {
  title: string; body: string; link?: string | null; audience: BroadcastAudience; target_role?: string | null;
  createdByStaffId: string; createdByName: string;
}): Promise<Broadcast> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error("Title and message are required.");
  const audience: BroadcastAudience = ["all", "staff", "clients", "role"].includes(input.audience) ? input.audience : "all";
  const target_role = audience === "role" ? (input.target_role || null) : null;
  if (audience === "role" && !target_role) throw new Error("Pick a role to target.");

  const { data, error } = await getSupabaseAdmin().from("broadcast_notifications").insert({
    title, body, link: input.link?.trim() || null, audience, target_role,
    created_by_staff_id: input.createdByStaffId, created_by_name: input.createdByName,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Broadcast;
}

export async function listBroadcasts(limit = 50): Promise<Broadcast[]> {
  const { data, error } = await getSupabaseAdmin().from("broadcast_notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Broadcast[];
}

// ── Opt-out preference ──────────────────────────────────────────────
export async function broadcastsEnabled(userKind: UserKind, userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("notification_prefs").select("broadcasts_enabled").eq("user_kind", userKind).eq("user_id", userId).maybeSingle();
  return data ? Boolean(data.broadcasts_enabled) : true;
}
export async function setBroadcastsEnabled(userKind: UserKind, userId: string, enabled: boolean): Promise<void> {
  await getSupabaseAdmin().from("notification_prefs").upsert(
    { user_kind: userKind, user_id: userId, broadcasts_enabled: enabled, updated_at: new Date().toISOString() },
    { onConflict: "user_kind,user_id" },
  );
}

async function readIds(userKind: UserKind, userId: string): Promise<Set<string>> {
  const { data } = await getSupabaseAdmin().from("broadcast_reads").select("broadcast_id").eq("user_kind", userKind).eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.broadcast_id as string));
}

// ── Per-user feeds (unread only, for the bell) ──────────────────────
export async function unreadBroadcastsForStaff(staffId: string, roleSlug: string): Promise<Broadcast[]> {
  if (!(await broadcastsEnabled("staff", staffId))) return [];
  const { data } = await getSupabaseAdmin()
    .from("broadcast_notifications").select("*")
    .or(`audience.eq.all,audience.eq.staff,and(audience.eq.role,target_role.eq.${roleSlug})`)
    .order("created_at", { ascending: false }).limit(50);
  const read = await readIds("staff", staffId);
  return ((data ?? []) as Broadcast[]).filter((b) => !read.has(b.id));
}

// Clients already have a real per-row notification system; deliver a broadcast
// by fanning out an in-app client_notifications row to every portal-enabled,
// opted-in client. (Client web push is a later increment.)
export async function fanOutToClients(b: Broadcast): Promise<string[]> {
  if (b.audience === "staff" || b.audience === "role") return [];
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("job_contacts").select("contact_id").eq("portal_access_enabled", true);
  const ids = [...new Set((data ?? []).map((r) => r.contact_id as string).filter(Boolean))];
  const { data: prefs } = await sb.from("notification_prefs").select("user_id").eq("user_kind", "client").eq("broadcasts_enabled", false);
  const optedOut = new Set((prefs ?? []).map((p) => p.user_id as string));
  const recipients = ids.filter((id) => !optedOut.has(id));
  if (!recipients.length) return [];
  const rows = recipients.map((contact_id) => ({
    contact_id, job_id: null, type: "broadcast", title: b.title, body: b.body,
    link: b.link || "/client/jobs", channels_sent: ["in_app"],
  }));
  await sb.from("client_notifications").insert(rows);
  return recipients;
}

export async function markBroadcastRead(userKind: UserKind, userId: string, broadcastId: string): Promise<void> {
  await getSupabaseAdmin().from("broadcast_reads").upsert(
    { broadcast_id: broadcastId, user_kind: userKind, user_id: userId, read_at: new Date().toISOString() },
    { onConflict: "broadcast_id,user_kind,user_id" },
  );
}

// Staff ids to web-push for a broadcast (excludes opted-out; empty for clients-only).
export async function staffPushRecipients(b: Broadcast): Promise<string[]> {
  if (b.audience === "clients") return [];
  const sb = getSupabaseAdmin();
  let q = sb.from("staff_users").select("id, role_slug, status").eq("status", "active");
  if (b.audience === "role" && b.target_role) q = q.eq("role_slug", b.target_role);
  const { data: staff } = await q;
  const { data: prefs } = await sb.from("notification_prefs").select("user_id").eq("user_kind", "staff").eq("broadcasts_enabled", false);
  const optedOut = new Set((prefs ?? []).map((p) => p.user_id as string));
  return (staff ?? []).map((s) => s.id as string).filter((id) => !optedOut.has(id));
}
