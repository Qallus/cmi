// Records a schedule item can point at (Schedule Builder): search across them
// for the item editor, and resolve one to the dashboard page that shows it.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LinkType } from "./types";

export type LinkHit = { type: LinkType; id: string; label: string; sub: string | null };

export const LINK_TYPES: LinkType[] = ["deal", "job", "precon", "company", "contact", "selection", "project", "punch_list", "schedule"];

const PER_TYPE = 6;

/** Search records by name across the given types (default: all). */
export async function searchLinkable(q: string, types: LinkType[] = LINK_TYPES): Promise<LinkHit[]> {
  const term = q.replace(/[%,()]/g, " ").trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const sb = getSupabaseAdmin();
  const want = new Set(types);
  const runs: Promise<LinkHit[]>[] = [];
  if (want.has("deal")) runs.push(Promise.resolve(sb.from("deals").select("id, title, stage").is("archived_at", null).ilike("title", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "deal" as const, id: r.id, label: r.title, sub: r.stage }))));
  if (want.has("job")) runs.push(Promise.resolve(sb.from("jobs").select("id, job_number, job_name, city").or(`job_name.ilike.${like},job_number.ilike.${like}`).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "job" as const, id: r.id, label: r.job_number || r.job_name, sub: r.city }))));
  if (want.has("precon")) runs.push(Promise.resolve(sb.from("pipeline_opportunities").select("id, opportunity_name, job_number").is("archived_at", null).or(`opportunity_name.ilike.${like},job_number.ilike.${like}`).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "precon" as const, id: r.id, label: r.opportunity_name || r.job_number, sub: "Pre-Con" }))));
  if (want.has("company")) runs.push(Promise.resolve(sb.from("companies").select("id, name, qualification_status").is("archived_at", null).ilike("name", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "company" as const, id: r.id, label: r.name, sub: r.qualification_status ?? null }))));
  if (want.has("contact")) runs.push(Promise.resolve(sb.from("contacts").select("id, first_name, last_name, company").or(`first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like}`).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "contact" as const, id: r.id, label: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Contact", sub: r.company ?? null }))));
  if (want.has("selection")) runs.push(Promise.resolve(sb.from("project_selections").select("id, name, category, status").ilike("name", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "selection" as const, id: r.id, label: r.name, sub: [r.category, r.status].filter(Boolean).join(" · ") || null }))));
  if (want.has("project")) runs.push(Promise.resolve(sb.from("projects").select("id, title, status").ilike("title", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "project" as const, id: r.id, label: r.title, sub: r.status ?? null }))));
  if (want.has("punch_list")) runs.push(Promise.resolve(sb.from("punch_lists").select("id, title").is("archived_at", null).ilike("title", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "punch_list" as const, id: r.id, label: r.title, sub: null }))));
  if (want.has("schedule")) runs.push(Promise.resolve(sb.from("job_schedules").select("id, name, type").neq("status", "archived").ilike("name", like).limit(PER_TYPE))
    .then(({ data }) => (data ?? []).map((r) => ({ type: "schedule" as const, id: r.id, label: r.name, sub: r.type }))));
  const settled = await Promise.allSettled(runs);
  return settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
}

/** The dashboard page for a linked record. */
export async function hrefForLink(type: LinkType, id: string): Promise<string> {
  const sb = getSupabaseAdmin();
  switch (type) {
    case "deal": return `/dashboard/pipeline/${id}`;
    case "job": return `/dashboard/jobs/${id}/summary`;
    case "precon": return `/dashboard/sales/${id}`;
    case "company": return `/dashboard/trade-partners?focus=${id}`;
    case "contact": return `/dashboard/contacts?focus=${id}`;
    case "selection": {
      const { data } = await sb.from("project_selections").select("job_id").eq("id", id).maybeSingle();
      return data?.job_id ? `/dashboard/jobs/${data.job_id}/selections` : "/dashboard/selections";
    }
    case "project": {
      const { data } = await sb.from("projects").select("job_id").eq("id", id).maybeSingle();
      return data?.job_id ? `/dashboard/jobs/${data.job_id}/projects` : "/dashboard/project-manager";
    }
    case "punch_list": {
      const { data } = await sb.from("punch_lists").select("job_id, deal_id, opportunity_id").eq("id", id).maybeSingle();
      if (data?.job_id) return `/dashboard/jobs/${data.job_id}/punch-list`;
      if (data?.deal_id) return `/dashboard/pipeline/${data.deal_id}`;
      if (data?.opportunity_id) return `/dashboard/sales/${data.opportunity_id}`;
      return "/dashboard/punch-lists";
    }
    case "schedule": {
      const { data } = await sb.from("job_schedules").select("job_id, scope_type, scope_id").eq("id", id).maybeSingle();
      if (data?.job_id) return `/dashboard/jobs/${data.job_id}/schedule?schedule=${id}`;
      if (data?.scope_id) return `/dashboard/schedules/${data.scope_type}/${data.scope_id}?schedule=${id}`;
      return "/dashboard/schedules";
    }
  }
}

/** A linked record's display name, looked up by id. */
export async function labelForLink(type: LinkType, id: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const one = async (table: string, cols: string) => (await sb.from(table).select(cols).eq("id", id).maybeSingle()).data as Record<string, string | null> | null;
  switch (type) {
    case "deal": return (await one("deals", "title"))?.title ?? null;
    case "job": { const r = await one("jobs", "job_number, job_name"); return r ? r.job_number || r.job_name : null; }
    case "precon": { const r = await one("pipeline_opportunities", "opportunity_name, job_number"); return r ? r.opportunity_name || r.job_number : null; }
    case "company": return (await one("companies", "name"))?.name ?? null;
    case "contact": { const r = await one("contacts", "first_name, last_name"); return r ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Contact" : null; }
    case "selection": return (await one("project_selections", "name"))?.name ?? null;
    case "project": return (await one("projects", "title"))?.title ?? null;
    case "punch_list": return (await one("punch_lists", "title"))?.title ?? null;
    case "schedule": return (await one("job_schedules", "name"))?.name ?? null;
  }
}
