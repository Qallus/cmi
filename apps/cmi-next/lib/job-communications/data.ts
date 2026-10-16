import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { JobWithRelations } from "@/lib/jobs/types";

// A job's communications: emails / SMS / calls from the global `messages` table.
// A message belongs to the job when it was sent from inside the job (job_id),
// or when it's with one of the job's clients or subs / vendors (contact_id).
export type JobComm = {
  id: string;
  direction: string | null;
  channel: string | null;
  contact_id: string | null;
  subject: string | null;
  body: string | null;
  from_address: string | null;
  to_address: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
};

/** Someone the job's Calls / SMS / Email tools can reach. */
export type JobRecipient = {
  key: string;
  contactId: string | null;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
};

export type JobCommCounts = { all: number; call: number; sms: number; email: number; notes: number };

const COLUMNS = "id, direction, channel, contact_id, subject, body, from_address, to_address, status, sent_at, created_at";

async function jobContactIds(jobId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const [clients, vendors] = await Promise.all([
    sb.from("job_contacts").select("contact_id").eq("job_id", jobId),
    sb.from("job_vendors").select("vendor_contact_id").eq("job_id", jobId),
  ]);
  return [...new Set([
    ...((clients.data ?? []) as { contact_id: string | null }[]).map((c) => c.contact_id),
    ...((vendors.data ?? []) as { vendor_contact_id: string | null }[]).map((v) => v.vendor_contact_id),
  ].filter(Boolean) as string[])];
}

export async function loadJobCommunications(jobId: string): Promise<JobComm[]> {
  const sb = getSupabaseAdmin();
  const ids = await jobContactIds(jobId);
  const filters = [`job_id.eq.${jobId}`, ...(ids.length ? [`contact_id.in.(${ids.join(",")})`] : [])];
  const { data, error } = await sb.from("messages").select(COLUMNS).or(filters.join(","))
    .order("created_at", { ascending: false }).limit(200);
  if (!error) return (data ?? []) as JobComm[];

  // Before the messages.job_id migration: contacts only.
  if (!ids.length) return [];
  const fallback = await sb.from("messages").select(COLUMNS).in("contact_id", ids)
    .order("created_at", { ascending: false }).limit(200);
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as JobComm[];
}

/** The job's clients, subs / vendors and team, for the To pickers. */
export function jobRecipients(job: JobWithRelations): JobRecipient[] {
  const out: JobRecipient[] = [];
  for (const c of job.contacts) {
    if (!c.contact) continue;
    const name = `${c.contact.first_name ?? ""} ${c.contact.last_name ?? ""}`.trim() || c.contact.company || "Client";
    out.push({ key: `client:${c.id}`, contactId: c.contact_id, name, role: c.is_primary ? "Primary client" : "Client", email: c.contact.email || null, phone: c.contact.phone || null });
  }
  for (const v of job.vendors) {
    if (!v.vendor) continue;
    const person = `${v.vendor.first_name ?? ""} ${v.vendor.last_name ?? ""}`.trim();
    const name = v.vendor.company ? (person ? `${v.vendor.company} (${person})` : v.vendor.company) : person || "Vendor";
    out.push({ key: `vendor:${v.id}`, contactId: v.vendor_contact_id, name, role: v.role || "Sub / Vendor", email: v.vendor.email || null, phone: v.vendor.phone || null });
  }
  for (const u of job.internal_users) {
    if (!u.user) continue;
    out.push({ key: `team:${u.id}`, contactId: null, name: u.user.display_name || u.user.email, role: u.role || "Team", email: u.user.email || null, phone: null });
  }
  return out;
}

export async function loadJobCommCounts(jobId: string): Promise<JobCommCounts> {
  const [comms, notes] = await Promise.all([
    loadJobCommunications(jobId).catch(() => [] as JobComm[]),
    getSupabaseAdmin().from("job_notes").select("id", { count: "exact", head: true }).eq("job_id", jobId),
  ]);
  const by = (ch: string) => comms.filter((m) => (m.channel ?? "").toLowerCase() === ch).length;
  return { all: comms.length, call: by("call"), sms: by("sms"), email: by("email"), notes: notes.count ?? 0 };
}
