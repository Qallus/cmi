import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { storageConfigured } from "@/lib/files/s3";
import { CloudClient, type ProjectOption } from "./cloud-client";

export const metadata = { title: "Cloud — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function CloudPage() {
  const staff = await getSessionStaff();
  const supabase = getSupabaseAdmin();
  let projects: ProjectOption[] = [];
  try {
    const { data } = await supabase.from("projects").select("id, title").order("title").limit(500);
    projects = (data ?? []).map((p) => ({ id: p.id, title: p.title || "Untitled project" }));
  } catch {
    // fall through
  }
  return <CloudClient projects={projects} meId={staff?.id ?? null} storageOnline={storageConfigured()} />;
}
