import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { TeamMember, TeamMemberDraft } from "./types";

export async function loadTeamMembers(): Promise<TeamMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("team_members").select("*").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

export async function loadActiveTeamMembers(): Promise<TeamMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("status", "active")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

export async function loadTeamMemberBySlug(slug: string): Promise<TeamMember | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TeamMember | null;
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

export async function loadTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("team_members").select("*").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TeamMember | null;
}

// Fields a team member is allowed to change on their OWN profile.
const SELF_EDITABLE: (keyof TeamMemberDraft)[] = [
  "name", "role", "department", "bio", "tagline", "phone",
  "profile_photo", "secondary_photo", "attributes", "availability",
];

export async function updateOwnTeamProfile(email: string, patch: Partial<TeamMemberDraft>): Promise<TeamMember | null> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("team_members").select("id").eq("email", email).maybeSingle();
  if (!existing) return null;
  const safe: Record<string, unknown> = {};
  for (const key of SELF_EDITABLE) if (key in patch) safe[key] = (patch as Record<string, unknown>)[key];
  safe.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("team_members").update(safe).eq("id", existing.id).select().single();
  if (error) throw new Error(error.message);
  return data as TeamMember;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
