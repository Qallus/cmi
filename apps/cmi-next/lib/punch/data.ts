// Punch list data access (service role; role checks live in the API routes).
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sanitizeHtml } from "@/lib/notes/html";
import { SYSTEM_TEMPLATES } from "./templates";
import {
  PARENT_COLUMN, PUNCH_PRIORITIES, parentOf,
  type PunchItem, type PunchItemDraft, type PunchList, type PunchParent, type PunchParentType, type PunchPriority, type PunchTemplate,
} from "./types";

export class PunchError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

type Actor = { id?: string | null; name?: string | null };
const now = () => new Date().toISOString();
const html = (v: unknown) => (typeof v === "string" && v.trim() ? sanitizeHtml(v) : null);
const text = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const priority = (v: unknown): PunchPriority => (PUNCH_PRIORITIES.includes(v as PunchPriority) ? (v as PunchPriority) : "normal");
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

// ─── Parents (the record a list hangs off) ────────────────────
export function parentHref(type: PunchParentType, id: string): string {
  if (type === "job") return `/dashboard/jobs/${id}/punch-list`;
  if (type === "precon") return `/dashboard/sales/${id}?tab=punch`;
  return `/dashboard/pipeline/${id}`;
}

const label = (num: string | null | undefined, name: string | null | undefined) =>
  [num, name].filter(Boolean).join(" · ") || "Untitled";

async function loadParents(refs: { type: PunchParentType; id: string }[]): Promise<Map<string, PunchParent>> {
  const sb = getSupabaseAdmin();
  const ids = (t: PunchParentType) => [...new Set(refs.filter((r) => r.type === t).map((r) => r.id))];
  const out = new Map<string, PunchParent>();
  const [deals, opps, jobs] = await Promise.all([
    ids("deal").length ? sb.from("deals").select("id,title,job_number").in("id", ids("deal")) : { data: [] },
    ids("precon").length ? sb.from("pipeline_opportunities").select("id,opportunity_name,job_number").in("id", ids("precon")) : { data: [] },
    ids("job").length ? sb.from("jobs").select("id,job_name,job_number").in("id", ids("job")) : { data: [] },
  ]);
  for (const d of (deals.data ?? []) as { id: string; title: string; job_number: string | null }[])
    out.set(`deal:${d.id}`, { type: "deal", id: d.id, label: label(d.job_number, d.title), href: parentHref("deal", d.id) });
  for (const o of (opps.data ?? []) as { id: string; opportunity_name: string; job_number: string | null }[])
    out.set(`precon:${o.id}`, { type: "precon", id: o.id, label: o.opportunity_name || label(o.job_number, null), href: parentHref("precon", o.id) });
  for (const j of (jobs.data ?? []) as { id: string; job_name: string; job_number: string | null }[])
    out.set(`job:${j.id}`, { type: "job", id: j.id, label: j.job_name || label(j.job_number, null), href: parentHref("job", j.id) });
  return out;
}

/** Search deals, Pre-Con and Jobs by name/number for the "Attach to…" picker. */
export async function searchTargets(q: string): Promise<PunchParent[]> {
  const sb = getSupabaseAdmin();
  const term = q.trim().replace(/[%,()]/g, " ");
  const like = `%${term}%`;
  const [deals, opps, jobs] = await Promise.all([
    sb.from("deals").select("id,title,job_number").is("archived_at", null)
      .or(term ? `title.ilike.${like},job_number.ilike.${like}` : "id.not.is.null").order("updated_at", { ascending: false }).limit(8),
    sb.from("pipeline_opportunities").select("id,opportunity_name,job_number").is("archived_at", null)
      .or(term ? `opportunity_name.ilike.${like},job_number.ilike.${like}` : "id.not.is.null").order("updated_at", { ascending: false }).limit(8),
    sb.from("jobs").select("id,job_name,job_number").is("archived_at", null).eq("is_template", false)
      .or(term ? `job_name.ilike.${like},job_number.ilike.${like}` : "id.not.is.null").order("updated_at", { ascending: false }).limit(8),
  ]);
  return [
    ...((jobs.data ?? []) as { id: string; job_name: string; job_number: string | null }[]).map((j) => ({ type: "job" as const, id: j.id, label: j.job_name, href: parentHref("job", j.id) })),
    ...((opps.data ?? []) as { id: string; opportunity_name: string; job_number: string | null }[]).map((o) => ({ type: "precon" as const, id: o.id, label: o.opportunity_name, href: parentHref("precon", o.id) })),
    ...((deals.data ?? []) as { id: string; title: string; job_number: string | null }[]).map((d) => ({ type: "deal" as const, id: d.id, label: label(d.job_number, d.title), href: parentHref("deal", d.id) })),
  ];
}

// ─── Lists ────────────────────────────────────────────────────
export async function loadLists(opts: {
  parentType?: PunchParentType; parentId?: string;
  /** Only lists with an open item assigned to this staff member. */
  assignedTo?: string;
  includeArchived?: boolean;
  /** Client portal: only client-visible lists. */
  clientVisibleOnly?: boolean;
} = {}): Promise<PunchList[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("punch_lists").select("*").order("sort_order").order("created_at");
  if (opts.parentType && opts.parentId) q = q.eq(PARENT_COLUMN[opts.parentType], opts.parentId);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  if (opts.clientVisibleOnly) q = q.eq("client_visible", true);
  if (opts.assignedTo) {
    const { data: mine } = await sb.from("punch_items").select("list_id").eq("assigned_to", opts.assignedTo).is("completed_at", null);
    const listIds = [...new Set((mine ?? []).map((r) => r.list_id as string))];
    if (!listIds.length) return [];
    q = q.in("id", listIds);
  }
  const { data: lists, error } = await q;
  if (error) throw new PunchError(error.message, 500);
  const rows = (lists ?? []) as Omit<PunchList, "items" | "parent">[];
  if (!rows.length) return [];

  const { data: items, error: iErr } = await sb.from("punch_items").select("*")
    .in("list_id", rows.map((l) => l.id)).order("sort_order").order("created_at");
  if (iErr) throw new PunchError(iErr.message, 500);
  const allItems = (items ?? []) as PunchItem[];

  const staffIds = [...new Set(allItems.map((i) => i.assigned_to).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (staffIds.length) {
    const { data: staff } = await sb.from("staff_users").select("id,display_name,first_name,last_name,email").in("id", staffIds);
    for (const s of staff ?? []) names.set(s.id, s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || "Staff");
  }
  const parents = await loadParents(rows.map(parentOf).filter(Boolean) as { type: PunchParentType; id: string }[]);

  return rows.map((l) => {
    const p = parentOf(l);
    return {
      ...l,
      parent: p ? parents.get(`${p.type}:${p.id}`) ?? null : null,
      items: allItems.filter((i) => i.list_id === l.id).map((i) => ({ ...i, assignee_name: i.assigned_to ? names.get(i.assigned_to) ?? null : null })),
    };
  });
}

export async function getList(id: string): Promise<PunchList | null> {
  const { data: row } = await getSupabaseAdmin().from("punch_lists").select("deal_id,opportunity_id,job_id").eq("id", id).maybeSingle();
  const p = row ? parentOf(row as Pick<PunchList, "deal_id" | "opportunity_id" | "job_id">) : null;
  if (!p) return null;
  const lists = await loadLists({ parentType: p.type, parentId: p.id, includeArchived: true });
  return lists.find((l) => l.id === id) ?? null;
}

async function assertParent(type: PunchParentType, id: string) {
  const table = type === "deal" ? "deals" : type === "precon" ? "pipeline_opportunities" : "jobs";
  const { data } = await getSupabaseAdmin().from(table).select("id").eq("id", id).maybeSingle();
  if (!data) throw new PunchError(`That ${type === "precon" ? "Pre-Con opportunity" : type} wasn't found.`, 404);
}

export async function createList(input: {
  parent_type: PunchParentType; parent_id: string; title: string;
  description?: string | null; client_visible?: boolean; template_id?: string | null;
  items?: PunchItemDraft[];
}, actor: Actor): Promise<PunchList> {
  const title = text(input.title, 200);
  if (!title) throw new PunchError("Give the punch list a title.");
  if (!PARENT_COLUMN[input.parent_type] || !input.parent_id) throw new PunchError("Choose a Pipeline deal, Pre-Con or Job to attach it to.");
  await assertParent(input.parent_type, input.parent_id);

  const sb = getSupabaseAdmin();
  // Only Job lists can be shown to clients — the portal exists only for jobs.
  const clientVisible = input.parent_type === "job" && !!input.client_visible;
  const { data, error } = await sb.from("punch_lists").insert({
    [PARENT_COLUMN[input.parent_type]]: input.parent_id,
    title,
    description: html(input.description),
    client_visible: clientVisible,
    template_id: input.template_id && !input.template_id.startsWith("sys:") ? input.template_id : null,
    created_by: actor.id ?? null,
    created_by_name: actor.name ?? null,
  }).select("id").single();
  if (error) throw new PunchError(error.message, 500);

  let items = input.items ?? [];
  if (!items.length && input.template_id) items = (await getTemplate(input.template_id))?.items ?? [];
  if (items.length) await addItems(data.id as string, items, actor);
  return (await getList(data.id as string))!;
}

export async function updateList(id: string, patch: {
  title?: string; description?: string | null; client_visible?: boolean; archived?: boolean;
  parent_type?: PunchParentType; parent_id?: string;
}): Promise<PunchList> {
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = { updated_at: now() };
  if (patch.title !== undefined) {
    const t = text(patch.title, 200);
    if (!t) throw new PunchError("The title can't be empty.");
    update.title = t;
  }
  if (patch.description !== undefined) update.description = html(patch.description);
  if (patch.archived !== undefined) update.archived_at = patch.archived ? now() : null;

  // Moving to another record (manual — lists never move on their own).
  let parentType: PunchParentType | null = null;
  if (patch.parent_type && patch.parent_id) {
    await assertParent(patch.parent_type, patch.parent_id);
    update.deal_id = null; update.opportunity_id = null; update.job_id = null;
    update[PARENT_COLUMN[patch.parent_type]] = patch.parent_id;
    parentType = patch.parent_type;
  }
  if (patch.client_visible !== undefined || parentType) {
    const { data: cur } = await sb.from("punch_lists").select("job_id,client_visible").eq("id", id).maybeSingle();
    if (!cur) throw new PunchError("Punch list not found.", 404);
    const isJob = parentType ? parentType === "job" : !!cur.job_id;
    const wanted = patch.client_visible ?? cur.client_visible;
    update.client_visible = isJob && !!wanted;
  }
  const { error } = await sb.from("punch_lists").update(update).eq("id", id);
  if (error) throw new PunchError(error.message, 500);
  const list = await getList(id);
  if (!list) throw new PunchError("Punch list not found.", 404);
  return list;
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("punch_lists").delete().eq("id", id);
  if (error) throw new PunchError(error.message, 500);
}

// ─── Items ────────────────────────────────────────────────────
export async function addItems(listId: string, drafts: PunchItemDraft[], actor: Actor): Promise<PunchItem[]> {
  const sb = getSupabaseAdmin();
  const clean = drafts
    .map((d) => ({ ...d, title: text(d.title, 300) }))
    .filter((d) => d.title)
    .slice(0, 300);
  if (!clean.length) throw new PunchError("Add at least one item.");
  const { data: last } = await sb.from("punch_items").select("sort_order").eq("list_id", listId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const start = ((last?.sort_order as number | undefined) ?? -1) + 1;
  const { data, error } = await sb.from("punch_items").insert(clean.map((d, i) => ({
    list_id: listId,
    title: d.title,
    notes: html(d.notes),
    location: text(d.location, 120),
    trade: text(d.trade, 120),
    priority: priority(d.priority),
    assigned_to: d.assigned_to || null,
    due_date: date(d.due_date),
    sort_order: start + i,
    created_by: actor.id ?? null,
  }))).select("*");
  if (error) throw new PunchError(error.message, 500);
  await sb.from("punch_lists").update({ updated_at: now() }).eq("id", listId);
  return (data ?? []) as PunchItem[];
}

export async function updateItem(id: string, patch: Partial<PunchItemDraft> & { done?: boolean; sort_order?: number }, actor: Actor): Promise<PunchItem> {
  const update: Record<string, unknown> = { updated_at: now() };
  if (patch.title !== undefined) {
    const t = text(patch.title, 300);
    if (!t) throw new PunchError("The item can't be empty.");
    update.title = t;
  }
  if (patch.notes !== undefined) update.notes = html(patch.notes);
  if (patch.location !== undefined) update.location = text(patch.location, 120);
  if (patch.trade !== undefined) update.trade = text(patch.trade, 120);
  if (patch.priority !== undefined) update.priority = priority(patch.priority);
  if (patch.assigned_to !== undefined) update.assigned_to = patch.assigned_to || null;
  if (patch.due_date !== undefined) update.due_date = date(patch.due_date);
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.done !== undefined) {
    update.completed_at = patch.done ? now() : null;
    update.completed_by = patch.done ? actor.id ?? null : null;
    update.completed_by_name = patch.done ? actor.name ?? null : null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("punch_items").update(update).eq("id", id).select("*").maybeSingle();
  if (error) throw new PunchError(error.message, 500);
  if (!data) throw new PunchError("Item not found.", 404);
  await sb.from("punch_lists").update({ updated_at: now() }).eq("id", data.list_id);
  return data as PunchItem;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("punch_items").delete().eq("id", id);
  if (error) throw new PunchError(error.message, 500);
}

// ─── Templates ────────────────────────────────────────────────
export async function listTemplates(): Promise<PunchTemplate[]> {
  const { data } = await getSupabaseAdmin().from("punch_templates").select("*").order("name");
  const saved = ((data ?? []) as (Omit<PunchTemplate, "items"> & { items: PunchItemDraft[] })[])
    .map((t) => ({ ...t, is_system: false }));
  return [...SYSTEM_TEMPLATES, ...saved];
}

export async function getTemplate(id: string): Promise<PunchTemplate | null> {
  if (id.startsWith("sys:")) return SYSTEM_TEMPLATES.find((t) => t.id === id) ?? null;
  const { data } = await getSupabaseAdmin().from("punch_templates").select("*").eq("id", id).maybeSingle();
  return data ? ({ ...data, is_system: false } as PunchTemplate) : null;
}

export async function saveTemplate(input: { name: string; category?: string | null; description?: string | null; items: PunchItemDraft[] }, actor: Actor): Promise<PunchTemplate> {
  const name = text(input.name, 120);
  if (!name) throw new PunchError("Name the template.");
  const items = (input.items ?? [])
    .map((i) => ({ title: text(i.title, 300), location: text(i.location, 120), trade: text(i.trade, 120) }))
    .filter((i) => i.title);
  if (!items.length) throw new PunchError("A template needs at least one item.");
  const { data, error } = await getSupabaseAdmin().from("punch_templates").insert({
    name, category: text(input.category, 60), description: text(input.description, 500), items, created_by: actor.id ?? null,
  }).select("*").single();
  if (error) throw new PunchError(error.message, 500);
  return { ...(data as PunchTemplate), is_system: false };
}

export async function deleteTemplate(id: string): Promise<void> {
  if (id.startsWith("sys:")) throw new PunchError("Built-in templates can't be deleted.", 403);
  const { error } = await getSupabaseAdmin().from("punch_templates").delete().eq("id", id);
  if (error) throw new PunchError(error.message, 500);
}
