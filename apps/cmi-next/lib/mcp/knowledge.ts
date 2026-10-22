// Company knowledge base search over bolt_training_docs (SOPs, templates,
// standards). Uses the generated `search` tsvector from the 2026-10-21 migration.
//   access_level 'all'       → every MCP caller
//   access_level 'financial' → roles that can read financials
//   access_level 'company'   → the Settings → Claude company-wide allowlist
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { McpCaller } from "./auth";

const MAX_CHARS = 6_000;

export async function searchKnowledge(caller: McpCaller, query: string, opts: { category?: string; limit?: number } = {}) {
  const levels = ["all", ...(caller.ctx.isAdmin ? ["financial"] : []), ...(caller.companyWide ? ["company"] : [])];
  let q = getSupabaseAdmin()
    .from("bolt_training_docs")
    .select("id, title, category, version, access_level, content, updated_at")
    .eq("enabled", true)
    .in("access_level", levels)
    .limit(Math.min(Math.max(opts.limit ?? 5, 1), 10));
  if (query.trim()) q = q.textSearch("search", query.trim(), { type: "websearch", config: "english" });
  if (opts.category) q = q.ilike("category", opts.category);

  const { data, error } = await q;
  if (error) return { error: error.message };
  if (!data?.length) return { results: [], note: "No matching documents. The knowledge base is managed in the dashboard under AI Agents → Training." };
  return {
    results: data.map((d) => ({
      id: d.id, title: d.title, category: d.category, version: d.version, updated_at: d.updated_at,
      content: d.content.length > MAX_CHARS ? `${d.content.slice(0, MAX_CHARS)}\n…(truncated)` : d.content,
    })),
  };
}
