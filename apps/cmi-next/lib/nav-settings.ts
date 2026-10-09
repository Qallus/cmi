// Sidebar items hidden company-wide from Settings → Sidebar navigation.
//
// Hiding only takes the link out of the sidebar; each page still has its own
// role and feature-flag checks. Settings can never be hidden, or there would
// be no way back to un-hide anything.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const NEVER_HIDDEN = ["/dashboard/settings"];

let cache: { at: number; value: string[] } | null = null;
const TTL_MS = 30_000;

/** Never throws: no row or no table means nothing is hidden. */
export async function loadHiddenNav(force = false): Promise<string[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const { data } = await getSupabaseAdmin().from("nav_settings").select("hidden_hrefs").eq("id", true).maybeSingle();
    const value = ((data as { hidden_hrefs: string[] } | null)?.hidden_hrefs ?? []).filter((h) => !NEVER_HIDDEN.includes(h));
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return [];
  }
}

export async function saveHiddenNav(hrefs: string[], staffId: string): Promise<string[]> {
  const clean = [...new Set(hrefs.filter((h) => typeof h === "string" && h.startsWith("/") && !NEVER_HIDDEN.includes(h)))];
  const { error } = await getSupabaseAdmin().from("nav_settings")
    .upsert({ id: true, hidden_hrefs: clean, updated_by: staffId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  cache = { at: Date.now(), value: clean };
  return clean;
}
