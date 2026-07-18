// DB-backed feature flags (table: feature_flags). Read through the service role,
// which bypasses RLS, so this must only be called from server code. A short
// in-process cache keeps flag reads off the hot path; toggling via the admin API
// clears it.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
};

let cache: { at: number; map: Record<string, boolean> } | null = null;
const TTL_MS = 30_000;

export async function loadFlags(force = false): Promise<Record<string, boolean>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map: Record<string, boolean> = {};
  try {
    const { data } = await getSupabaseAdmin().from("feature_flags").select("key, enabled");
    for (const row of data ?? []) map[row.key as string] = Boolean(row.enabled);
    cache = { at: Date.now(), map };
  } catch {
    // If the table isn't there yet (pre-migration), treat everything as off.
    return cache?.map ?? {};
  }
  return map;
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const map = await loadFlags();
  return map[key] === true;
}

export function clearFlagCache(): void {
  cache = null;
}
