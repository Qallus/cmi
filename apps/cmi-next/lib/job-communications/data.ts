import { getSupabaseAdmin } from "@/lib/supabase/server";

// A job's communications: emails / SMS / calls from the global `messages` table,
// scoped by the job's linked contacts (messages link by contact_id, not job_id).
export type JobComm = {
  id: string;
  direction: string | null;
  channel: string | null;
  subject: string | null;
  body: string | null;
  from_address: string | null;
  to_address: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
};

export async function loadJobCommunications(jobId: string): Promise<JobComm[]> {
  const sb = getSupabaseAdmin();
  const { data: contacts } = await sb.from("job_contacts").select("contact_id").eq("job_id", jobId);
  const ids = (contacts ?? []).map((c) => c.contact_id).filter(Boolean) as string[];
  if (!ids.length) return [];
  const { data, error } = await sb
    .from("messages")
    .select("id, direction, channel, subject, body, from_address, to_address, status, sent_at, created_at")
    .in("contact_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as JobComm[];
}
