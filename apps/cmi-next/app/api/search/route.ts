// Global dashboard search — powers the top-bar search box. Staff-only.
// Aggregates a few high-value navigable entities and returns grouped results.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export type SearchHit = {
  id: string;
  group: "Contacts" | "Jobs" | "Documents";
  title: string;
  subtitle: string | null;
  href: string;
};

const PER_GROUP = 6;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });

  // Escape PostgREST `or` filter metacharacters in the user's term.
  const term = q.replace(/[%,()]/g, " ").trim();
  const like = `%${term}%`;
  const sb = getSupabaseAdmin();

  const [contacts, jobs, docs] = await Promise.all([
    sb.from("contacts")
      .select("id, first_name, last_name, email, company")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company.ilike.${like},phone.ilike.${like}`)
      .limit(PER_GROUP),
    sb.from("jobs")
      .select("id, job_number, job_name, status, city")
      .or(`job_name.ilike.${like},job_number.ilike.${like},city.ilike.${like}`)
      .limit(PER_GROUP),
    sb.from("documents")
      .select("id, title, client, type, status")
      .or(`title.ilike.${like},client.ilike.${like},project.ilike.${like}`)
      .limit(PER_GROUP),
  ]);

  const hits: SearchHit[] = [];

  for (const c of contacts.data ?? []) {
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact";
    hits.push({
      id: c.id, group: "Contacts", title: name,
      subtitle: [c.company, c.email].filter(Boolean).join(" · ") || null,
      href: `/dashboard/contacts?focus=${c.id}`,
    });
  }
  for (const j of jobs.data ?? []) {
    hits.push({
      id: j.id, group: "Jobs", title: j.job_name || j.job_number || "Job",
      subtitle: [j.job_number, j.city, j.status].filter(Boolean).join(" · ") || null,
      href: `/dashboard/jobs/${j.id}/summary`,
    });
  }
  for (const d of docs.data ?? []) {
    hits.push({
      id: d.id, group: "Documents", title: d.title || "Untitled document",
      subtitle: [d.client, d.type, d.status].filter(Boolean).join(" · ") || null,
      href: `/dashboard/documents?focus=${d.id}`,
    });
  }

  return NextResponse.json({ hits });
}
