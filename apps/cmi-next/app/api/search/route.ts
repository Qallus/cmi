// Global dashboard search — powers the top-bar search box. Staff-only.
// Every word must match (in any of a record's searchable fields), so
// "waters 26" finds The Waters Residence (26_001) and "ben framing" finds the
// framing task assigned to Ben. Each group opens its own page. Groups follow
// the same roles as the sidebar; private daily logs only show to their author.
// Dashboard pages ("Go to") are matched in the browser from the sidebar list.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

import type { SearchHit } from "@/lib/search/types";
export type { SearchHit } from "@/lib/search/types";

const PER_GROUP = 5;
const SALES_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

/** The words of the query, cleaned for a PostgREST `or` filter (max 5). */
export function searchWords(q: string): string[] {
  return q.replace(/[%,()*\\]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 1).slice(0, 5);
}

type Query = { or: (filter: string) => Query };
/** Every word must appear in at least one of the fields. */
function everyWord<T extends Query>(q: T, fields: string[], words: string[]): T {
  let out = q;
  for (const w of words) out = out.or(fields.map((f) => `${f}.ilike.%${w}%`).join(",")) as T;
  return out;
}
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

export async function GET(request: Request) {
  let staff: { id: string; role_slug: string };
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const words = searchWords(q);
  if (q.length < 2 || !words.length) return NextResponse.json({ hits: [] });
  const sb = getSupabaseAdmin();
  const sales = SALES_ROLES.includes(staff.role_slug);
  const none = Promise.resolve({ data: [] as never[] });

  const [contacts, jobs, deals, precon, partners, selections, cos, invoices, tasks, logs, punch, cloud, docs] = await Promise.all([
    everyWord(sb.from("contacts").select("id, first_name, last_name, email, company"), ["first_name", "last_name", "email", "company", "phone"], words).limit(PER_GROUP),
    everyWord(sb.from("jobs").select("id, job_number, job_name, status, city").is("archived_at", null), ["job_name", "job_number", "city", "street_address"], words).limit(PER_GROUP),
    sales ? everyWord(sb.from("deals").select("id, title, stage, job_number").is("archived_at", null), ["title", "job_number"], words).limit(PER_GROUP) : none,
    sales ? everyWord(sb.from("pipeline_opportunities").select("id, opportunity_name, job_number, stage").is("archived_at", null), ["opportunity_name", "job_number"], words).limit(PER_GROUP) : none,
    sales ? everyWord(sb.from("companies").select("id, name, trades").is("archived_at", null), ["name", "trades_other"], words).limit(PER_GROUP) : none,
    everyWord(sb.from("project_selections").select("id, name, category, status, job_id, job:jobs(job_number, job_name)"), ["name", "category", "client_name"], words).limit(PER_GROUP),
    everyWord(sb.from("change_orders").select("id, co_number, title, status, job_id, job:jobs(job_number, job_name)"), ["title", "co_number"], words).limit(PER_GROUP),
    sales ? everyWord(sb.from("invoices").select("id, invoice_number, title, status, job_id, job:jobs(job_number, job_name)"), ["title", "invoice_number"], words).limit(PER_GROUP) : none,
    // Tasks: any word in the title or location here; every word (incl. assignee names, job, schedule) checked below.
    sb.from("schedule_items").select("id, title, location, start_date, job_id, schedule_id, assignees, schedule:job_schedules(name, status), job:jobs(job_number, job_name)")
      .neq("status", "cancelled").or(words.flatMap((w) => [`title.ilike.%${w}%`, `location.ilike.%${w}%`]).join(",")).limit(300),
    everyWord(sb.from("daily_logs").select("id, title, log_date, job_id, deal_id, opportunity_id, visibility, created_by_id, job:jobs(job_number, job_name)")
      .or(`visibility.neq.private,created_by_id.eq.${staff.id}`), ["title", "notes"], words).order("log_date", { ascending: false }).limit(PER_GROUP),
    everyWord(sb.from("punch_items").select("id, title, location, list:punch_lists(id, title, job_id, deal_id, opportunity_id)"), ["title", "location", "notes"], words).limit(PER_GROUP),
    everyWord(sb.from("files").select("id, name, mime_type").is("deleted_at", null), ["name"], words).limit(PER_GROUP),
    everyWord(sb.from("documents").select("id, title, client, type, status"), ["title", "client", "project"], words).limit(PER_GROUP),
  ]);

  type JobRef = { job_number: string | null; job_name: string | null } | null;
  const jobLabel = (j: JobRef) => j?.job_number || j?.job_name || null;
  const hits: SearchHit[] = [];
  const push = (h: SearchHit) => hits.push(h);

  for (const j of jobs.data ?? []) push({ id: j.id, group: "Jobs", title: j.job_name || j.job_number || "Job", subtitle: join(j.job_number, j.city, j.status), href: `/dashboard/jobs/${j.id}/summary` });
  for (const c of contacts.data ?? []) {
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact";
    push({ id: c.id, group: "Contacts", title: name, subtitle: join(c.company, c.email), href: `/dashboard/contacts?focus=${c.id}` });
  }
  for (const d of (deals.data ?? []) as { id: string; title: string; stage: string | null; job_number: string | null }[]) push({ id: d.id, group: "Pipeline", title: d.title, subtitle: join(d.job_number, d.stage?.replace(/_/g, " ")), href: `/dashboard/pipeline/${d.id}` });
  for (const o of (precon.data ?? []) as { id: string; opportunity_name: string | null; job_number: string | null; stage: string | null }[]) push({ id: o.id, group: "Pre-Con", title: o.opportunity_name || o.job_number || "Pre-Con project", subtitle: join(o.job_number, o.stage?.replace(/_/g, " ")), href: `/dashboard/sales/${o.id}` });
  for (const c of (partners.data ?? []) as { id: string; name: string; trades: string[] | null }[]) push({ id: c.id, group: "Trade Partners", title: c.name, subtitle: join((c.trades ?? []).slice(0, 3).join(", ")), href: `/dashboard/trade-partners?focus=${c.id}` });
  for (const s of (selections.data ?? []) as unknown as { id: string; name: string; category: string | null; status: string | null; job_id: string | null; job: JobRef }[]) push({ id: s.id, group: "Selections", title: s.name, subtitle: join(jobLabel(s.job), s.category, s.status), href: s.job_id ? `/dashboard/jobs/${s.job_id}/selections` : "/dashboard/selections" });
  for (const c of (cos.data ?? []) as unknown as { id: string; co_number: string | null; title: string; status: string | null; job_id: string; job: JobRef }[]) push({ id: c.id, group: "Change Orders", title: c.title, subtitle: join(c.co_number, jobLabel(c.job), c.status), href: `/dashboard/jobs/${c.job_id}/change-orders` });
  for (const i of (invoices.data ?? []) as unknown as { id: string; invoice_number: string | null; title: string | null; status: string | null; job_id: string; job: JobRef }[]) push({ id: i.id, group: "Invoices", title: i.title || i.invoice_number || "Invoice", subtitle: join(i.invoice_number, jobLabel(i.job), i.status), href: `/dashboard/jobs/${i.job_id}/invoices` });
  type Task = { id: string; title: string; location: string | null; start_date: string | null; job_id: string | null; schedule_id: string; assignees: { name?: string }[] | null; schedule: { name: string; status: string } | null; job: JobRef };
  const lower = words.map((w) => w.toLowerCase());
  const matchingTasks = ((tasks.data ?? []) as unknown as Task[]).filter((t) => {
    if (t.schedule?.status === "archived") return false;
    const hay = [t.title, t.location, ...(t.assignees ?? []).map((a) => a?.name), t.job?.job_number, t.job?.job_name, t.schedule?.name].filter(Boolean).join(" ").toLowerCase();
    return lower.every((w) => hay.includes(w));
  }).slice(0, PER_GROUP);
  for (const t of matchingTasks) {
    const who = (t.assignees ?? []).map((a) => a?.name).filter(Boolean).slice(0, 2).join(", ");
    push({ id: t.id, group: "Schedule", title: t.title, subtitle: join(jobLabel(t.job), who, t.start_date), href: t.job_id ? `/dashboard/jobs/${t.job_id}/schedule?schedule=${t.schedule_id}` : "/dashboard/schedules" });
  }
  for (const l of (logs.data ?? []) as unknown as { id: string; title: string | null; log_date: string; job_id: string | null; deal_id: string | null; opportunity_id: string | null; job: JobRef }[]) {
    const href = l.job_id ? `/dashboard/jobs/${l.job_id}/daily-logs` : l.deal_id ? `/dashboard/pipeline/${l.deal_id}` : l.opportunity_id ? `/dashboard/sales/${l.opportunity_id}` : "/dashboard/daily-logs";
    push({ id: l.id, group: "Daily Logs", title: l.title || "Daily log", subtitle: join(jobLabel(l.job), l.log_date), href });
  }
  for (const p of (punch.data ?? []) as unknown as { id: string; title: string; location: string | null; list: { id: string; title: string; job_id: string | null; deal_id: string | null; opportunity_id: string | null } | null }[]) {
    const L = p.list;
    const href = L?.job_id ? `/dashboard/jobs/${L.job_id}/punch-list` : L?.deal_id ? `/dashboard/pipeline/${L.deal_id}` : L?.opportunity_id ? `/dashboard/sales/${L.opportunity_id}` : "/dashboard/punch-lists";
    push({ id: p.id, group: "Punch Lists", title: p.title, subtitle: join(L?.title, p.location), href });
  }
  for (const f of (cloud.data ?? []) as { id: string; name: string; mime_type: string | null }[]) push({ id: f.id, group: "Cloud", title: f.name, subtitle: join(f.mime_type?.split("/")[1]?.toUpperCase()), href: "/dashboard/cloud" });
  for (const d of docs.data ?? []) push({ id: d.id, group: "Documents", title: d.title || "Untitled document", subtitle: join(d.client, d.type, d.status), href: `/dashboard/documents?focus=${d.id}` });

  return NextResponse.json({ hits });
}
