// A job's client message thread (the portal's Messages). Shared by the job
// Messages page (app/api/jobs/[id]/messages) and Claude.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyJobClients } from "@/lib/client-portal/notifications";

/** The thread, oldest first. `markRead` marks the client's unread messages read (staff viewed it). */
export async function loadJobMessages(jobId: string, opts: { markRead?: boolean } = {}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("job_messages").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (opts.markRead) await sb.from("job_messages").update({ read_at: new Date().toISOString() }).eq("job_id", jobId).eq("sender_type", "client").is("read_at", null);
  return data ?? [];
}

/** A staff reply. Client-visible replies notify the job's clients; internal ones don't. */
export async function postJobMessage(jobId: string, input: { body: string; visibility?: string; category?: string }, staff: { id: string; name: string }) {
  const body = input.body.trim();
  if (!body) throw new Error("Message can't be empty.");
  const { data, error } = await getSupabaseAdmin().from("job_messages").insert({
    job_id: jobId, sender_type: "staff", sender_id: staff.id, sender_name: staff.name,
    body, category: input.category ?? "general", visibility: input.visibility === "internal" ? "internal" : "client_visible",
  }).select().single();
  if (error) throw new Error(error.message);
  if (data.visibility === "client_visible") {
    notifyJobClients(jobId, { type: "message", title: "New message from your team", body: body.slice(0, 140), link: `/client/jobs/${jobId}/messages` }).catch(() => {});
  }
  return data;
}
