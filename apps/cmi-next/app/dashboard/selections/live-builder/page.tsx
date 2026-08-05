import { getSupabaseAdmin } from "@/lib/supabase/server";
import { LiveBuilderClient, type BuilderVendor, type BuilderOption } from "./live-builder-client";

export const dynamic = "force-dynamic";

export default async function LiveBuilderPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams;
  let vendors: BuilderVendor[] = [];
  let jobs: BuilderOption[] = [];
  let projects: BuilderOption[] = [];

  try {
    const sb = getSupabaseAdmin();
    const [vRes, jRes, pRes] = await Promise.all([
      sb.from("selection_vendors").select("id, name, website_url, logo_url, category, status").eq("status", "active").order("name"),
      sb.from("jobs").select("id, job_number, job_name, full_address").order("created_at", { ascending: false }).limit(500),
      sb.from("projects").select("id, title").order("created_at", { ascending: false }).limit(500),
    ]);
    vendors = (vRes.data ?? []) as BuilderVendor[];
    jobs = (jRes.data ?? []).map((j) => ({
      id: j.id as string,
      label: [j.job_number, j.job_name].filter(Boolean).join(" · ") || (j.job_name as string) || "Job",
      sublabel: (j.full_address as string) ?? null,
    }));
    projects = (pRes.data ?? []).map((p) => ({ id: p.id as string, label: (p.title as string) || "Untitled project", sublabel: null }));
  } catch {
    /* render with empty option sets; the builder still works for manual entry */
  }

  return <LiveBuilderClient vendors={vendors} jobs={jobs} projects={projects} initialJobId={job ?? ""} />;
}
