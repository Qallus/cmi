import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MyProfileClient } from "./my-profile-client";

export const metadata = { title: "My Profile - CMI Dashboard" };

async function loadProfile() {
  const supabase = getSupabaseAdmin();
  const preferredEmails = ["jwaters@qallus.co", "jw.qallus@gmail.com", "jeremy@constructedmatter.com"];

  for (const email of preferredEmails) {
    const { data, error } = await supabase.from("team_members").select("*").eq("email", email).maybeSingle();
    if (!error && data) return data;
  }

  const { data } = await supabase
    .from("team_members")
    .select("*")
    .eq("status", "active")
    .order("sort_order")
    .order("name")
    .limit(1)
    .maybeSingle();

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
