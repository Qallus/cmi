// What's New entries: the cards in the Overview's What's New row. Written by
// admins (Settings → What's New); Bolt and Claude can draft them, and only an
// admin publishes.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { NEWS_ICON_NAMES } from "./news-icons";

export type WhatsNewRow = {
  id: string; title: string; body: string; href: string | null; icon: string | null; tag: string | null;
  published_at: string | null; created_by: string | null; created_at: string; updated_at: string;
};

const COLS = "id, title, body, href, icon, tag, published_at, created_by, created_at, updated_at";

export function cleanNews(input: Record<string, unknown>, partial = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  if (!partial || has("title")) {
    const t = str(input.title, 120);
    if (!t) throw new Error("A What's New entry needs a title.");
    out.title = t;
  }
  if (!partial || has("body")) out.body = str(input.body, 600);
  if (has("href")) {
    const h = str(input.href, 300);
    out.href = h && (h.startsWith("/") || /^https:\/\//.test(h)) ? h : null;
  }
  if (has("icon")) out.icon = NEWS_ICON_NAMES.includes(str(input.icon, 40)) ? str(input.icon, 40) : null;
  if (has("tag")) out.tag = str(input.tag, 24) || null;
  return out;
}

export async function listNews(): Promise<WhatsNewRow[]> {
  const { data, error } = await getSupabaseAdmin().from("whats_new").select(COLS).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as WhatsNewRow[];
}

export async function createNews(input: Record<string, unknown>, actorId: string | null, publish = false): Promise<WhatsNewRow> {
  const row = { ...cleanNews(input), created_by: actorId, published_at: publish ? new Date().toISOString() : null };
  const { data, error } = await getSupabaseAdmin().from("whats_new").insert(row).select(COLS).single();
  if (error) throw new Error(error.message);
  return data as WhatsNewRow;
}

export async function updateNews(id: string, input: Record<string, unknown>): Promise<WhatsNewRow> {
  const patch: Record<string, unknown> = { ...cleanNews(input, true), updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input, "published")) patch.published_at = input.published ? new Date().toISOString() : null;
  const { data, error } = await getSupabaseAdmin().from("whats_new").update(patch).eq("id", id).select(COLS).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Entry not found.");
  return data as WhatsNewRow;
}

export async function deleteNews(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("whats_new").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
