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
  const { data, error } = await sb.from("messages").insert(msg).select().single();
  if (error) throw new Error(error.message);
  return data as Message;
}
