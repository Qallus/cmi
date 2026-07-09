// Client notification dispatch: always create an in-app notification, then fan
// out to email (Resend) and SMS (Twilio) per the client's channel preferences.
// SMS additionally requires a non-suppressed number (messaging consent). All
// delivery is best-effort — a failed channel never blocks the primary write.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isSuppressed } from "@/lib/messaging/consent";
import { logMessage } from "@/lib/communications/data";

export type NotifyPayload = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null; // relative path within /client
};

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
}

function emailHtml(title: string, body: string | null | undefined, url: string): string {
  const logo = `${appUrl()}/brand/CMI_Line_Logo_White.svg`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:520px;width:100%;">
      <tr><td style="background:#111;padding:22px 32px;text-align:center;"><img src="${logo}" alt="Constructed Matter, Inc." width="160" style="height:auto;" /></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;">Project Update</p>
        <h1 style="margin:0 0 12px;font-size:20px;color:#111;">${title}</h1>
        ${body ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">${body}</p>` : ""}
        <a href="${url}" style="display:inline-block;background:#C87A3A;border-radius:6px;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Open Project Portal &rarr;</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Send to a single client contact (respecting their preferences).
export async function notifyClient(contactId: string, jobId: string | null, payload: NotifyPayload): Promise<void> {
  const sb = getSupabaseAdmin();
  const url = `${appUrl()}${payload.link ?? (jobId ? `/client/jobs/${jobId}` : "/client/jobs")}`;

  // 1) In-app (always).
  const { data: notif } = await sb.from("client_notifications").insert({
    contact_id: contactId, job_id: jobId, type: payload.type, title: payload.title, body: payload.body ?? null,
    link: payload.link ?? (jobId ? `/client/jobs/${jobId}` : "/client/jobs"), channels_sent: ["in_app"],
  }).select("id").single();
  const channels = ["in_app"];

  const [{ data: contact }, { data: prefs }] = await Promise.all([
    sb.from("contacts").select("email, phone, first_name").eq("id", contactId).maybeSingle(),
    sb.from("client_notification_prefs").select("*").eq("contact_id", contactId).maybeSingle(),
  ]);
  const emailEnabled = prefs?.email_enabled ?? true;   // default on
  const smsEnabled = prefs?.sms_enabled ?? false;      // default off (opt-in)

  // 2) Email via Resend.
  if (emailEnabled && contact?.email) {
    try {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM_EMAIL || "noreply@constructedmatter.com";
      if (key) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: contact.email, subject: payload.title, html: emailHtml(payload.title, payload.body, url) }),
        });
        if (res.ok) {
          channels.push("email");
          await logMessage({ direction: "outbound", channel: "email", contact_id: contactId, to_address: contact.email, from_address: from, subject: payload.title, body: payload.body ?? payload.title, status: "sent", project_id: null, quote_id: null, provider: "resend", provider_id: null, error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString() }).catch(() => {});
        }
      }
    } catch { /* best-effort */ }
  }

  // 3) SMS via Twilio (opt-in + not suppressed).
  if (smsEnabled && contact?.phone) {
    try {
      const suppressed = await isSuppressed("sms", contact.phone);
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, fromNum = process.env.TWILIO_PHONE_NUMBER;
      if (!suppressed && sid && token && fromNum) {
        const smsBody = `${payload.title}${payload.body ? ` — ${payload.body}` : ""} ${url}`.slice(0, 320);
        const creds = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST", headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: contact.phone, From: fromNum, Body: smsBody }).toString(),
        });
        if (res.ok) {
          channels.push("sms");
          await logMessage({ direction: "outbound", channel: "sms", contact_id: contactId, to_address: contact.phone, from_address: fromNum, subject: null, body: smsBody, status: "sent", project_id: null, quote_id: null, provider: "twilio", provider_id: null, error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString() }).catch(() => {});
        }
      }
    } catch { /* best-effort */ }
  }

  if (notif && channels.length > 1) {
    try { await sb.from("client_notifications").update({ channels_sent: channels }).eq("id", notif.id); } catch { /* best-effort */ }
  }
}

// ── Client-side reads + preferences (used by the portal) ──
export type ClientNotification = { id: string; job_id: string | null; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
export type ClientPrefs = { email_enabled: boolean; sms_enabled: boolean };

export async function loadClientNotifications(contactId: string): Promise<ClientNotification[]> {
  const { data } = await getSupabaseAdmin().from("client_notifications").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as ClientNotification[];
}
export async function unreadNotificationCount(contactId: string): Promise<number> {
  const { count } = await getSupabaseAdmin().from("client_notifications").select("id", { count: "exact", head: true }).eq("contact_id", contactId).is("read_at", null);
  return count ?? 0;
}
export async function markNotificationsRead(contactId: string, ids?: string[]): Promise<void> {
  let q = getSupabaseAdmin().from("client_notifications").update({ read_at: new Date().toISOString() }).eq("contact_id", contactId).is("read_at", null);
  if (ids && ids.length) q = q.in("id", ids);
  await q;
}
export async function getClientPrefs(contactId: string): Promise<ClientPrefs> {
  const { data } = await getSupabaseAdmin().from("client_notification_prefs").select("email_enabled, sms_enabled").eq("contact_id", contactId).maybeSingle();
  return { email_enabled: data?.email_enabled ?? true, sms_enabled: data?.sms_enabled ?? false };
}
export async function updateClientPrefs(contactId: string, patch: Partial<ClientPrefs>): Promise<ClientPrefs> {
  const { data, error } = await getSupabaseAdmin().from("client_notification_prefs")
    .upsert({ contact_id: contactId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "contact_id" })
    .select("email_enabled, sms_enabled").single();
  if (error) throw new Error(error.message);
  return data as ClientPrefs;
}

// Fan out to every portal-enabled client contact on a job.
export async function notifyJobClients(jobId: string, payload: NotifyPayload): Promise<void> {
  const { data } = await getSupabaseAdmin()
    .from("job_contacts").select("contact_id").eq("job_id", jobId).eq("portal_access_enabled", true);
  const ids = Array.from(new Set((data ?? []).map((r) => r.contact_id).filter(Boolean))) as string[];
  await Promise.all(ids.map((id) => notifyClient(id, jobId, payload).catch(() => {})));
}
