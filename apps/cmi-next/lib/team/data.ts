import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { TeamMember, TeamMemberDraft } from "./types";

export async function loadTeamMembers(): Promise<TeamMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("team_members").select("*").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

export async function createTeamMember(draft: TeamMemberDraft): Promise<TeamMember> {
  const supabase = getSupabaseAdmin();
  const slug = draft.slug || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await supabase.from("team_members").insert({ ...draft, slug }).select().single();
  if (error) throw new Error(error.message);
  return data as TeamMember;
}

export async function updateTeamMember(id: string, patch: Partial<TeamMemberDraft>): Promise<TeamMember> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("team_members").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as TeamMember;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
