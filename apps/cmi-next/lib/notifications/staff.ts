// Staff dashboard notification center — the source of the top-bar bell badge.
// Aggregates the same four "unread" sources counted by
// /api/notifications/unread-count into a listable, mark-readable feed:
//   1. new contact-form submissions (contact_submissions.status = 'new')
//   2. unread inbound messages       (messages: inbound + received + notification_read_at null)
//   3. new business-card leads        (business_card_leads.status = 'new' + notification_read_at null)
//   4. shared dashboard review notes  (dashboard_notes, unread by this user's email in read_by[])
//
// messages and business_card_leads have no natural "read" status (their status
// enums are delivery-/pipeline-state), so we track notification-read separately
// via notification_read_at without touching their business status. Submissions
// use status='read'; notes append the reader's email to read_by[].

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type StaffNotificationKind = "submission" | "message" | "lead" | "note";

export type StaffNotification = {
  id: string;
  kind: StaffNotificationKind;
  title: string;
  subtitle: string;
  time: string; // ISO timestamp
  href: string;
};

type Ctx = { email: string; staffId: string; isAdmin: boolean };

const HREF: Record<StaffNotificationKind, string> = {
  submission: "/dashboard/communications",
  message: "/dashboard/communications",
  lead: "/dashboard/business-cards",
  note: "/dashboard/site-content",
};

function messageTitle(channel: string | null): string {
  switch ((channel ?? "").toLowerCase()) {
    case "email": return "New email";
    case "sms": return "New text message";
    case "call": case "voice": return "New call";
    default: return "New message";
  }
}

function snippet(text: string | null, max = 90): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export async function loadStaffNotifications(ctx: Ctx): Promise<StaffNotification[]> {
  const supabase = getSupabaseAdmin();
  const email = ctx.email.toLowerCase();

  let leadsQuery = supabase
    .from("business_card_leads")
    .select("id, name, email, company, created_at")
    .eq("status", "new")
    .is("notification_read_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!ctx.isAdmin) leadsQuery = leadsQuery.eq("owner_staff_id", ctx.staffId);

  const [submissionsRes, messagesRes, leadsRes, notesRes] = await Promise.all([
    supabase
      .from("contact_submissions")
      .select("id, first_name, last_name, subject, message, submitted_at, created_at")
      .eq("status", "new")
      .order("submitted_at", { ascending: false })
      .limit(50),
    supabase
      .from("messages")
      .select("id, channel, from_address, subject, body, sent_at, created_at")
      .eq("direction", "inbound")
      .eq("status", "received")
      .is("notification_read_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    leadsQuery,
    email
      ? supabase
          .from("dashboard_notes")
          .select("id, page_title, note, created_by_name, read_by, created_at")
          .contains("recipient_emails", [email])
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const items: StaffNotification[] = [];

  for (const s of (submissionsRes.data ?? []) as Record<string, unknown>[]) {
    const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Someone";
    items.push({
      id: String(s.id),
      kind: "submission",
      title: "New contact form submission",
      subtitle: snippet(`${name}${s.subject ? ` — ${s.subject}` : ""}: ${s.message ?? ""}`),
      time: String(s.submitted_at ?? s.created_at),
      href: HREF.submission,
    });
  }

  for (const m of (messagesRes.data ?? []) as Record<string, unknown>[]) {
    items.push({
      id: String(m.id),
      kind: "message",
      title: messageTitle(m.channel as string | null),
      subtitle: snippet(`${m.from_address ? `${m.from_address} · ` : ""}${m.subject || m.body || ""}`),
      time: String(m.sent_at ?? m.created_at),
      href: HREF.message,
    });
  }

  for (const l of (leadsRes.data ?? []) as Record<string, unknown>[]) {
    const name = String(l.name ?? "").trim() || String(l.email ?? "").trim() || "New lead";
    items.push({
      id: String(l.id),
      kind: "lead",
      title: "New business card lead",
      subtitle: snippet(`${name}${l.company ? ` · ${l.company}` : ""}`),
      time: String(l.created_at),
      href: HREF.lead,
    });
  }

  for (const n of (notesRes.data ?? []) as Record<string, unknown>[]) {
    const readBy = ((n.read_by as string[] | null) ?? []).map((e) => e.toLowerCase());
    if (readBy.includes(email)) continue;
    items.push({
      id: String(n.id),
      kind: "note",
      title: `Note: ${String(n.page_title ?? "Dashboard request")}`,
      subtitle: snippet(`${n.created_by_name ? `${n.created_by_name}: ` : ""}${n.note ?? ""}`),
      time: String(n.created_at),
      href: HREF.note,
    });
  }

  items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  return items;
}

// Mark a single notification read. Best-effort; returns true on success.
export async function markStaffNotificationRead(
  ctx: Ctx,
  kind: StaffNotificationKind,
  id: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const nowExpr = new Date().toISOString();

  try {
    if (kind === "submission") {
      await supabase.from("contact_submissions").update({ status: "read" }).eq("id", id);
    } else if (kind === "message") {
      await supabase.from("messages").update({ notification_read_at: nowExpr }).eq("id", id);
    } else if (kind === "lead") {
      let q = supabase.from("business_card_leads").update({ notification_read_at: nowExpr }).eq("id", id);
      if (!ctx.isAdmin) q = q.eq("owner_staff_id", ctx.staffId);
      await q;
    } else if (kind === "note") {
      const email = ctx.email.toLowerCase();
      const { data } = await supabase.from("dashboard_notes").select("read_by").eq("id", id).maybeSingle();
      const readBy = ((data?.read_by as string[] | null) ?? []).map((e) => e.toLowerCase());
      if (!readBy.includes(email)) {
        await supabase.from("dashboard_notes").update({ read_by: [...readBy, email] }).eq("id", id);
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Mark every currently-unread notification read for this user.
export async function markAllStaffNotificationsRead(ctx: Ctx): Promise<number> {
  const items = await loadStaffNotifications(ctx);
  await Promise.all(items.map((i) => markStaffNotificationRead(ctx, i.kind, i.id)));
  return items.length;
}
