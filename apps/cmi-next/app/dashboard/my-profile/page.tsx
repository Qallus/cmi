import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MyProfileClient } from "./my-profile-client";

export const metadata = { title: "My Profile — CMI Dashboard" };

async function loadProfile() {
  const supabase = getSupabaseAdmin();
  // Look up the team member record for Jeremy Waters
  const { data } = await supabase.from("team_members").select("*").eq("email", "jwaters@qallus.co").maybeSingle();
  return data ?? null;
}

export default async function MyProfilePage() {
  try {
    const profile = await loadProfile();
    return <MyProfileClient profile={profile} />;
  } catch {
    return <MyProfileClient profile={null} />;
  }
}
