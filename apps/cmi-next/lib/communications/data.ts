import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Message } from "./types";

export async function loadMessages(channel?: string, limit = 100): Promise<Message[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("messages")
    .select(`*, contact:contacts(first_name, last_name, email, phone)`)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (channel && channel !== "all") q = q.eq("channel", channel);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function logMessage(msg: Omit<Message, "id" | "created_at">): Promise<Message> {
  const sb = getSupabaseAdmin();
  let { data, error } = await sb.from("messages").insert(msg).select().single();
  // Until the messages.job_id migration has run, log without the job tag
  // rather than lose the record of a message that was already sent.
  if (error && "job_id" in msg && /job_id/.test(error.message)) {
    const { job_id: _job, ...rest } = msg;
    void _job;
    ({ data, error } = await sb.from("messages").insert(rest).select().single());
  }
  if (error) throw new Error(error.message);
  return data as Message;
}
