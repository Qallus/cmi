import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MyProfileClient } from "./my-profile-client";

export const metadata = { title: "My Profile - CMI Dashboard" };

async function loadProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cmi-session")?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.email) return null;

  const { data } = await supabase
    .from("team_members")
    .select("*")
    .eq("email", user.email)
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
