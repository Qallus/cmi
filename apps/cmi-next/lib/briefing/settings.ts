// Morning briefing controls (the briefing_settings row), edited by Super Admins
// on Dashboard → Notifications → Morning Briefing.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type BriefingSettings = {
  auto_enabled: boolean;
  audience: "all" | "selected";
  recipient_ids: string[];
  include_ai: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

export const DEFAULT_BRIEFING_SETTINGS: BriefingSettings = {
  auto_enabled: true, audience: "all", recipient_ids: [], include_ai: true, updated_by: null, updated_at: null,
};

/** Never throws: a missing row or table falls back to the defaults (send to everyone). */
export async function loadBriefingSettings(): Promise<BriefingSettings> {
  try {
    const { data } = await getSupabaseAdmin().from("briefing_settings").select("*").eq("id", true).maybeSingle();
    return data ? { ...DEFAULT_BRIEFING_SETTINGS, ...(data as Partial<BriefingSettings>) } : DEFAULT_BRIEFING_SETTINGS;
  } catch {
    return DEFAULT_BRIEFING_SETTINGS;
  }
}

export async function saveBriefingSettings(
  patch: Partial<Pick<BriefingSettings, "auto_enabled" | "audience" | "recipient_ids" | "include_ai">>,
  staffId: string,
): Promise<BriefingSettings> {
  const clean: Record<string, unknown> = { id: true, updated_by: staffId, updated_at: new Date().toISOString() };
  if (typeof patch.auto_enabled === "boolean") clean.auto_enabled = patch.auto_enabled;
  if (typeof patch.include_ai === "boolean") clean.include_ai = patch.include_ai;
  if (patch.audience === "all" || patch.audience === "selected") clean.audience = patch.audience;
  if (Array.isArray(patch.recipient_ids)) clean.recipient_ids = patch.recipient_ids.filter((x) => typeof x === "string");
  const { data, error } = await getSupabaseAdmin().from("briefing_settings").upsert(clean, { onConflict: "id" }).select("*").single();
  if (error) throw new Error(error.message);
  return { ...DEFAULT_BRIEFING_SETTINGS, ...(data as Partial<BriefingSettings>) };
}
