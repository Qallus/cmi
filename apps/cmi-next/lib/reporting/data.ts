// Data access for the weekly workload meeting report.
//
// A report is a snapshot of the meeting agenda: sections, the projects and
// leads under each, and the action items attached to those. Items can be
// linked to a real record (job / deal / opportunity) or stand alone, which is
// what makes the General Items and Office Items sections work.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_SECTIONS } from "./parse";
import { parseMeetingDocument, parseLooseDate } from "./parse";
import type {
  ChangeGroup, ChangeRow, MeetingReport, OpenActionItem,
  ReportActionItem, ReportDetail, ReportItem, ReportSection, ReportSummary,
} from "./types";

export class ReportingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type Actor = { id: string; name?: string | null };

function fail(message: string, error: { message: string } | null): never | void {
  if (error) throw new ReportingError(`${message}: ${error.message}`, 500);
}

// ─── Reports ───────────────────────────────────────────────────────────────

export async function listReports(): Promise<ReportSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("meeting_reports")
    .select("*, report_items(id), report_items_count:report_items(count)")
    .order("meeting_date", { ascending: false });
  fail("Couldn't load reports", error);

  const reports = (data ?? []) as unknown as (MeetingReport & { report_items: { id: string }[] })[];
  if (reports.length === 0) return [];

  // Open action items per report, counted in one pass.
  const ids = reports.flatMap((r) => r.report_items.map((i) => i.id));
  const openByItem = new Map<string, number>();
  if (ids.length) {
    const { data: actions } = await supabase
      .from("report_action_items")
      .select("report_item_id")
      .in("report_item_id", ids)
      .is("completed_at", null);
    for (const a of (actions ?? []) as { report_item_id: string }[]) {
      openByItem.set(a.report_item_id, (openByItem.get(a.report_item_id) ?? 0) + 1);
    }
  }

  return reports.map((r) => ({
    ...r,
    report_items: undefined as never,
    item_count: r.report_items.length,
    open_action_count: r.report_items.reduce((sum, i) => sum + (openByItem.get(i.id) ?? 0), 0),
  })) as ReportSummary[];
}

export async function getReport(id: string): Promise<ReportDetail | null> {
  const supabase = getSupabaseAdmin();
  const { data: report, error } = await supabase.from("meeting_reports").select("*").eq("id", id).maybeSingle();
  fail("Couldn't load the report", error);
  if (!report) return null;

  const { data: sections } = await supabase
    .from("report_sections").select("*").eq("report_id", id).order("sort_order");
  const { data: items } = await supabase
    .from("report_items").select("*").eq("report_id", id).order("sort_order");

  const itemIds = (items ?? []).map((i) => i.id as string);
  let actions: ReportActionItem[] = [];
  if (itemIds.length) {
    const { data } = await supabase
      .from("report_action_items").select("*").in("report_item_id", itemIds).order("sort_order");
    actions = (data ?? []) as ReportActionItem[];
  }

  const byItem = new Map<string, ReportActionItem[]>();
  for (const a of actions) {
    const list = byItem.get(a.report_item_id) ?? [];
    list.push(a);
    byItem.set(a.report_item_id, list);
  }

  const bySection = new Map<string, ReportItem[]>();
  for (const raw of (items ?? []) as ReportItem[]) {
    const item: ReportItem = { ...raw, action_items: byItem.get(raw.id) ?? [] };
    const list = bySection.get(item.section_id) ?? [];
    list.push(item);
    bySection.set(item.section_id, list);
  }

  return {
    ...(report as MeetingReport),
    sections: ((sections ?? []) as ReportSection[]).map((s) => ({ ...s, items: bySection.get(s.id) ?? [] })),
  };
}

export async function createReport(
  input: { title?: string; meeting_date: string; populate?: boolean; carry_forward?: boolean },
  actor: Actor,
): Promise<ReportDetail> {
  const supabase = getSupabaseAdmin();

  // Chain to the previous meeting so "changes since" has an anchor.
  const { data: previous } = await supabase
    .from("meeting_reports")
    .select("id, meeting_date")
    .lt("meeting_date", input.meeting_date)
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: report, error } = await supabase
    .from("meeting_reports")
    .insert({
      title: input.title?.trim() || `Weekly Workload Meeting — ${input.meeting_date}`,
      meeting_date: input.meeting_date,
      previous_report_id: previous?.id ?? null,
      compare_since: previous?.meeting_date ?? null,
      created_by: actor.id,
    })
    .select()
    .single();
  fail("Couldn't create the report", error);

  const reportId = (report as MeetingReport).id;
  await seedSections(reportId);
  if (input.populate !== false) await populateFromRecords(reportId);
  if (input.carry_forward !== false && previous?.id) await carryForwardOpenActions(reportId, previous.id);

  return (await getReport(reportId))!;
}

async function seedSections(reportId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("report_sections").insert(
    DEFAULT_SECTIONS.map((s, index) => ({ report_id: reportId, key: s.key, title: s.title, sort_order: index })),
  );
  fail("Couldn't create the report sections", error);
}

export async function updateReport(id: string, patch: Partial<MeetingReport>): Promise<MeetingReport> {
  const supabase = getSupabaseAdmin();
  const allowed: Partial<MeetingReport> = {};
  for (const key of ["title", "meeting_date", "status", "compare_since", "notes"] as const) {
    if (key in patch) (allowed as Record<string, unknown>)[key] = patch[key];
  }
  if (patch.status === "final") allowed.finalized_at = new Date().toISOString();
  if (patch.status === "draft") allowed.finalized_at = null;

  const { data, error } = await supabase
    .from("meeting_reports")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  fail("Couldn't save the report", error);
  return data as MeetingReport;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("meeting_reports").delete().eq("id", id);
  fail("Couldn't delete the report", error);
}

// ─── Sections and items ────────────────────────────────────────────────────

export async function addSection(reportId: string, title: string): Promise<ReportSection> {
  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase
    .from("report_sections").select("sort_order").eq("report_id", reportId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const key = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "section"}_${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("report_sections")
    .insert({ report_id: reportId, key, title: title.trim(), sort_order: (last?.sort_order ?? -1) + 1 })
    .select().single();
  fail("Couldn't add the section", error);
  return { ...(data as ReportSection), items: [] };
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("report_sections").delete().eq("id", id);
  fail("Couldn't delete the section", error);
}

export async function addItem(reportId: string, sectionId: string, patch: Partial<ReportItem>): Promise<ReportItem> {
  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase
    .from("report_items").select("sort_order").eq("section_id", sectionId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("report_items")
    .insert({
      ...cleanItem(patch),
      report_id: reportId,
      section_id: sectionId,
      title: patch.title?.trim() || "New item",
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select().single();
  fail("Couldn't add the item", error);
  return { ...(data as ReportItem), action_items: [] };
}

const ITEM_FIELDS = [
  "record_type", "record_id", "job_number", "title", "status_text", "scope",
  "design_partner", "value_note", "original_completion", "current_completion",
  "warranty_date", "financial_note", "latest_update", "procurement_note", "notes",
] as const;

function cleanItem(patch: Partial<ReportItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ITEM_FIELDS) if (key in patch) out[key] = patch[key] ?? null;
  return out;
}

export async function updateItem(id: string, patch: Partial<ReportItem>, actor: Actor): Promise<ReportItem> {
  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from("report_items").select("*").eq("id", id).maybeSingle();
  if (!before) throw new ReportingError("Item not found.", 404);

  const { data, error } = await supabase
    .from("report_items")
    .update({ ...cleanItem(patch), updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  fail("Couldn't save the item", error);

  const after = data as ReportItem;
  // "Enter once": a new narrative update on a linked record also lands on that
  // record's own timeline, so the job or lead page tells the same story.
  if (after.record_id && after.latest_update && after.latest_update !== (before as ReportItem).latest_update) {
    await logUpdateToRecord(after, actor);
  }
  return { ...after, action_items: [] };
}

async function logUpdateToRecord(item: ReportItem, actor: Actor): Promise<void> {
  if (!item.record_id) return;
  const column = item.record_type === "job" ? "job_id" : item.record_type === "deal" ? "deal_id" : null;
  if (!column) return;

  await getSupabaseAdmin().from("activities").insert({
    [column]: item.record_id,
    type: "note",
    summary: "Weekly meeting update",
    body: item.latest_update,
    created_by: actor.id,
    created_by_name: actor.name ?? null,
    occurred_at: new Date().toISOString(),
  });
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("report_items").delete().eq("id", id);
  fail("Couldn't delete the item", error);
}

export async function moveItem(id: string, sectionId: string, sortOrder: number): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("report_items")
    .update({ section_id: sectionId, sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", id);
  fail("Couldn't move the item", error);
}

// ─── Action items ──────────────────────────────────────────────────────────

export async function addAction(itemId: string, patch: Partial<ReportActionItem>): Promise<ReportActionItem> {
  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase
    .from("report_action_items").select("sort_order").eq("report_item_id", itemId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("report_action_items")
    .insert({
      report_item_id: itemId,
      body: patch.body?.trim() || "New action item",
      owner_staff_id: patch.owner_staff_id ?? null,
      owner_label: patch.owner_label ?? null,
      due_date: patch.due_date ?? null,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select().single();
  fail("Couldn't add the action item", error);
  return data as ReportActionItem;
}

export async function updateAction(id: string, patch: Partial<ReportActionItem>): Promise<ReportActionItem> {
  const out: Record<string, unknown> = {};
  for (const key of ["body", "owner_staff_id", "owner_label", "due_date", "completed_at"] as const) {
    if (key in patch) out[key] = patch[key] ?? null;
  }
  const { data, error } = await getSupabaseAdmin()
    .from("report_action_items")
    .update({ ...out, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  fail("Couldn't save the action item", error);
  return data as ReportActionItem;
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("report_action_items").delete().eq("id", id);
  fail("Couldn't delete the action item", error);
}

/** Open items from the previous meeting reappear on the new agenda. */
export async function carryForwardOpenActions(reportId: string, fromReportId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const previous = await getReport(fromReportId);
  const target = await getReport(reportId);
  if (!previous || !target) return 0;

  // Match by linked record first, then by job number, then by title.
  const key = (item: ReportItem) => item.record_id ?? item.job_number ?? item.title.toLowerCase();
  const targetByKey = new Map(target.sections.flatMap((s) => s.items).map((i) => [key(i), i]));

  const rows: Record<string, unknown>[] = [];
  for (const section of previous.sections) {
    for (const item of section.items) {
      const open = item.action_items.filter((a) => !a.completed_at);
      if (open.length === 0) continue;
      const match = targetByKey.get(key(item));
      if (!match) continue;
      open.forEach((a, index) => rows.push({
        report_item_id: match.id,
        body: a.body,
        owner_staff_id: a.owner_staff_id,
        owner_label: a.owner_label,
        due_date: a.due_date,
        carried_from_id: a.id,
        sort_order: 1000 + index,
      }));
    }
  }

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("report_action_items").insert(rows);
  fail("Couldn't carry forward the open items", error);
  return rows.length;
}

// ─── Populating a report from live records ─────────────────────────────────

const STALE_DAYS = 45;

/**
 * Fill the standard sections from what's in the system: active and warranty
 * jobs, pre-con budgets, and open leads split by how recently they moved.
 * Items that are already on the report are left alone, so this is safe to
 * re-run on an existing report.
 */
export async function populateFromRecords(reportId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const report = await getReport(reportId);
  if (!report) throw new ReportingError("Report not found.", 404);

  const sectionByKey = new Map(report.sections.map((s) => [s.key, s]));
  const existing = new Set(
    report.sections.flatMap((s) => s.items).map((i) => i.record_id ?? i.job_number ?? i.title.toLowerCase()),
  );

  const staleBefore = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const [jobs, opportunities, deals] = await Promise.all([
    supabase.from("jobs")
      .select("id, job_number, job_name, status, projected_completion_date, actual_completion_date, current_phase, next_milestone")
      .in("status", ["active_project", "warranty", "active_budget", "pre_construction_design"])
      .is("archived_at", null)
      .order("job_number"),
    supabase.from("pipeline_opportunities")
      .select("id, job_number, opportunity_name, stage, estimated_project_value, projected_construction_start_date, notes")
      .not("stage", "in", '("closed","lost")')
      .order("job_number"),
    supabase.from("deals")
      .select("id, job_number, title, stage, estimated_value, last_activity_at, next_action, next_action_due, next_action_owner_id")
      .not("stage", "in", '("closed_won")')
      .order("job_number"),
  ]);

  const rows: Record<string, unknown>[] = [];
  const push = (sectionKey: string, row: Record<string, unknown>, dedupe: string) => {
    const section = sectionByKey.get(sectionKey);
    if (!section || existing.has(dedupe)) return;
    existing.add(dedupe);
    rows.push({ ...row, report_id: reportId, section_id: section.id, sort_order: rows.length });
  };

  for (const job of (jobs.data ?? []) as Record<string, string | null>[]) {
    const target = job.status === "warranty" ? "warranty"
      : job.status === "active_project" ? "active_projects" : "precon";
    push(target, {
      record_type: "job", record_id: job.id, job_number: job.job_number,
      title: job.job_name ?? "Job",
      status_text: job.current_phase ?? null,
      current_completion: job.projected_completion_date ?? null,
      latest_update: job.next_milestone ?? null,
    }, job.id!);
  }

  for (const opp of (opportunities.data ?? []) as Record<string, string | null>[]) {
    push("precon", {
      record_type: "opportunity", record_id: opp.id, job_number: opp.job_number,
      title: opp.opportunity_name ?? "Opportunity",
      status_text: opp.stage ?? null,
      notes: opp.notes ?? null,
    }, opp.id!);
  }

  for (const deal of (deals.data ?? []) as Record<string, string | null>[]) {
    const stale = !deal.last_activity_at || deal.last_activity_at < staleBefore;
    const onHold = deal.stage === "lost_on_hold";
    push(stale || onHold ? "long_term_leads" : "active_leads", {
      record_type: "deal", record_id: deal.id, job_number: deal.job_number,
      title: deal.title ?? "Lead",
      status_text: deal.stage ?? null,
      latest_update: deal.next_action ?? null,
    }, deal.id!);
  }

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("report_items").insert(rows);
  fail("Couldn't populate the report", error);
  return rows.length;
}

// ─── Import ────────────────────────────────────────────────────────────────

/** Parse a past meeting document and save it as a report. */
export async function importDocument(
  text: string,
  input: { title?: string; meeting_date?: string },
  actor: Actor,
): Promise<{ report: ReportDetail; items: number; actions: number }> {
  const parsed = parseMeetingDocument(text);
  const meetingDate = input.meeting_date || parsed.meetingDate;
  if (!meetingDate) {
    throw new ReportingError("Couldn't find a meeting date in the document — set one and import again.", 400);
  }
  if (parsed.sections.length === 0) {
    throw new ReportingError("Nothing recognisable in that document. Paste the outline with its bullets intact.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: report, error } = await supabase
    .from("meeting_reports")
    .insert({
      title: input.title?.trim() || `Weekly Workload Meeting — ${meetingDate}`,
      meeting_date: meetingDate,
      created_by: actor.id,
    })
    .select().single();
  fail("Couldn't create the report", error);
  const reportId = (report as MeetingReport).id;

  // Known sections keep their standard order; anything else follows.
  const order = new Map(DEFAULT_SECTIONS.map((s, index) => [s.key as string, index]));
  const sectionRows = parsed.sections.map((s, index) => ({
    report_id: reportId, key: s.key, title: s.title,
    sort_order: order.get(s.key) ?? 100 + index,
  }));
  const { data: sections, error: sectionError } = await supabase
    .from("report_sections").insert(sectionRows).select();
  fail("Couldn't create the report sections", sectionError);

  const sectionId = new Map(((sections ?? []) as ReportSection[]).map((s) => [s.key, s.id]));

  let itemCount = 0;
  let actionCount = 0;
  for (const section of parsed.sections) {
    const id = sectionId.get(section.key);
    if (!id) continue;

    const itemRows = section.items.map((item, index) => ({
      report_id: reportId,
      section_id: id,
      sort_order: index,
      job_number: item.jobNumber,
      title: item.title || "Untitled",
      status_text: item.statusText,
      scope: item.scope,
      design_partner: item.designPartner,
      value_note: item.valueNote,
      // Dates that don't parse are kept verbatim in the notes rather than lost.
      original_completion: parseLooseDate(item.originalCompletion),
      current_completion: parseLooseDate(item.currentCompletion),
      warranty_date: parseLooseDate(lastDate(item.warrantyDate)),
      financial_note: item.financialNote,
      latest_update: item.latestUpdate,
      procurement_note: item.procurementNote,
      notes: keepRawDates(item),
    }));

    const { data: saved, error: itemError } = await supabase.from("report_items").insert(itemRows).select("id");
    fail("Couldn't save the imported items", itemError);
    const savedIds = ((saved ?? []) as { id: string }[]).map((r) => r.id);
    itemCount += savedIds.length;

    const actionRows: Record<string, unknown>[] = [];
    section.items.forEach((item, index) => {
      const itemId = savedIds[index];
      if (!itemId) return;
      item.actions.forEach((action, order2) => actionRows.push({
        report_item_id: itemId,
        body: action.body,
        owner_label: action.ownerLabel,
        sort_order: order2,
      }));
    });
    if (actionRows.length) {
      const { error: actionError } = await supabase.from("report_action_items").insert(actionRows);
      fail("Couldn't save the imported action items", actionError);
      actionCount += actionRows.length;
    }
  }

  await linkImportedItems(reportId);
  return { report: (await getReport(reportId))!, items: itemCount, actions: actionCount };
}

/** "August 22nd 2025/ August 22nd 2027" — the warranty expiry is the later one. */
function lastDate(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : raw;
}

/** Date text the parser couldn't read is preserved rather than dropped. */
function keepRawDates(item: { originalCompletion: string | null; currentCompletion: string | null; warrantyDate: string | null; notes: string | null }): string | null {
  const kept: string[] = [];
  if (item.originalCompletion && !parseLooseDate(item.originalCompletion)) kept.push(`Original completion: ${item.originalCompletion}`);
  if (item.currentCompletion && !parseLooseDate(item.currentCompletion)) kept.push(`Current completion: ${item.currentCompletion}`);
  if (item.warrantyDate) kept.push(`Substantial completion / warranty: ${item.warrantyDate}`);
  const all = [item.notes, ...kept].filter(Boolean);
  return all.length ? all.join("\n") : null;
}

/** Match imported rows to real records by job number, so links come for free. */
async function linkImportedItems(reportId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: items } = await supabase
    .from("report_items").select("id, job_number").eq("report_id", reportId).not("job_number", "is", null);
  const numbers = [...new Set(((items ?? []) as { job_number: string }[]).map((i) => i.job_number))];
  if (numbers.length === 0) return;

  const [jobs, opportunities, deals] = await Promise.all([
    supabase.from("jobs").select("id, job_number").in("job_number", numbers),
    supabase.from("pipeline_opportunities").select("id, job_number").in("job_number", numbers),
    supabase.from("deals").select("id, job_number").in("job_number", numbers),
  ]);

  const lookup = new Map<string, { type: string; id: string }>();
  for (const row of (deals.data ?? []) as { id: string; job_number: string }[]) lookup.set(row.job_number, { type: "deal", id: row.id });
  for (const row of (opportunities.data ?? []) as { id: string; job_number: string }[]) lookup.set(row.job_number, { type: "opportunity", id: row.id });
  for (const row of (jobs.data ?? []) as { id: string; job_number: string }[]) lookup.set(row.job_number, { type: "job", id: row.id });

  for (const item of (items ?? []) as { id: string; job_number: string }[]) {
    const match = lookup.get(item.job_number);
    if (!match) continue;
    await supabase.from("report_items").update({ record_type: match.type, record_id: match.id }).eq("id", item.id);
  }
}

// ─── Changes since / open action items ─────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  deals: "Lead", jobs: "Job", pipeline_opportunities: "Pre-Con", projections: "Projection", deal_tasks: "Task",
};

const HREF: Record<string, (id: string) => string> = {
  deals: (id) => `/dashboard/pipeline/${id}`,
  jobs: (id) => `/dashboard/jobs/${id}/summary`,
  projections: (id) => `/dashboard/projections/${id}`,
};

/** Everything that moved between two dates, grouped by record. */
export async function loadChanges(since: string, until?: string): Promise<ChangeGroup[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("record_changes")
    .select("*")
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(2000);
  if (until) query = query.lte("changed_at", until);

  const { data, error } = await query;
  fail("Couldn't load the change log", error);
  const rows = (data ?? []) as ChangeRow[];

  const actorIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: staff } = await supabase.from("staff_users").select("id, display_name, email").in("id", actorIds);
    for (const s of (staff ?? []) as { id: string; display_name: string | null; email: string | null }[]) {
      names.set(s.id, s.display_name || s.email || "Staff");
    }
  }

  // Notes added in the same window, counted per record.
  const noteCounts = new Map<string, number>();
  const { data: notes } = await supabase
    .from("activities").select("deal_id, job_id").gte("created_at", since).limit(2000);
  for (const n of (notes ?? []) as { deal_id: string | null; job_id: string | null }[]) {
    const key = n.deal_id ? `deals:${n.deal_id}` : n.job_id ? `jobs:${n.job_id}` : null;
    if (key) noteCounts.set(key, (noteCounts.get(key) ?? 0) + 1);
  }

  const groups = new Map<string, ChangeGroup>();
  for (const row of rows) {
    const key = `${row.table_name}:${row.record_id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        table_name: row.table_name,
        record_id: row.record_id,
        record_label: row.record_label || `${TABLE_LABELS[row.table_name] ?? row.table_name} ${row.record_id.slice(0, 8)}`,
        href: HREF[row.table_name]?.(row.record_id) ?? null,
        changes: [],
        notes_added: noteCounts.get(key) ?? 0,
      };
      groups.set(key, group);
    }
    group.changes.push({ ...row, changed_by_name: row.changed_by ? names.get(row.changed_by) ?? null : null });
  }

  return [...groups.values()];
}

/** Open action items across every report, for the by-person view. */
export async function loadOpenActions(): Promise<OpenActionItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("report_action_items")
    .select("*, report_items!inner(id, title, job_number, report_id, meeting_reports!inner(id, title, meeting_date))")
    .is("completed_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  fail("Couldn't load the action items", error);

  const rows = (data ?? []) as unknown as (ReportActionItem & {
    report_items: { id: string; title: string; job_number: string | null; report_id: string; meeting_reports: { id: string; title: string; meeting_date: string } };
  })[];

  const ownerIds = [...new Set(rows.map((r) => r.owner_staff_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ownerIds.length) {
    const { data: staff } = await supabase.from("staff_users").select("id, display_name, email").in("id", ownerIds);
    for (const s of (staff ?? []) as { id: string; display_name: string | null; email: string | null }[]) {
      names.set(s.id, s.display_name || s.email || "Staff");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => ({
    ...row,
    report_items: undefined as never,
    report_id: row.report_items.report_id,
    report_title: row.report_items.meeting_reports.title,
    meeting_date: row.report_items.meeting_reports.meeting_date,
    item_title: row.report_items.title,
    job_number: row.report_items.job_number,
    owner_name: row.owner_staff_id ? names.get(row.owner_staff_id) ?? null : row.owner_label,
    overdue: !!row.due_date && row.due_date < today,
  })) as OpenActionItem[];
}
