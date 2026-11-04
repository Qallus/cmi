// Field Reports, Step 4: what an Executive Summary for a Job draws on for a
// chosen period (plan: docs/features/field-reports/field-reports-plan.md).
//
// Client guardrail: Delays/Issues, On site, Action items and Internal notes
// never go to the client as written. They're handed to Bolt only as context
// it may turn into one calm, client-ready sentence, and the review panel lists
// them as "Kept internal" with an Add back option. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { jobScheduleHeader } from "@/lib/schedules/data";
import { clientSafeItems, normalizeSections, SECTION_LABELS, type LogItem } from "@/lib/daily-logs/sections";
import type { Audience, SummaryPhoto } from "./snapshot";

export type KeptItem = { id: string; section: string; sectionLabel: string; text: string; date: string };
export type Period = { start: string; end: string };

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const todayAZ = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

/** The period asked for, or the last seven days. */
export function periodOf(start?: string | null, end?: string | null): Period {
  const ok = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const e = ok(end) ?? todayAZ();
  const s = ok(start) ?? addDays(e, -6);
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

const itemView = (i: LogItem) => ({
  section: SECTION_LABELS[i.section], text: i.text, ...(i.star ? { star: true } : {}),
  ...(i.section === "inspections" && i.result ? { result: i.result } : {}),
  ...(i.section === "onsite" ? { company: i.company, trade: i.trade, crew: i.crew } : {}),
  ...(i.section === "delays" && i.impact ? { impact: i.impact } : {}),
  ...(i.section === "actions" ? { owner: i.owner, due: i.due } : {}),
});

export async function fieldReportExtras(jobId: string, audience: Audience, period: Period, addBack: string[], pickedPhotoIds: string[]): Promise<{
  data: Record<string, unknown>; keptInternal: KeptItem[]; photos: SummaryPhoto[];
}> {
  const sb = getSupabaseAdmin();
  const client = audience === "client";
  const t = todayAZ();
  const [logs, header, sched, cos, invoices, sels, lib, picked] = await Promise.all([
    sb.from("daily_logs").select("id, log_date, log_number, status, sections").eq("job_id", jobId).eq("report_version", 2)
      .gte("log_date", period.start).lte("log_date", period.end).order("log_date", { ascending: true }),
    jobScheduleHeader(jobId).catch(() => null),
    sb.from("schedule_items").select("title, kind, status, start_date, end_date, client_visible, contract_date, milestone_type")
      .eq("job_id", jobId).order("start_date", { ascending: true }).limit(500),
    sb.from("change_orders").select("co_number, title, status, amount, client_visible").eq("job_id", jobId),
    client ? Promise.resolve({ data: [] }) : sb.from("invoices").select("invoice_number, status, amount, amount_paid, due_date, created_at").eq("job_id", jobId),
    sb.from("project_selections").select("name, selection_status, approval_status, target_decision_date, client_visible").eq("job_id", jobId).not("target_decision_date", "is", null),
    sb.from("job_photos").select("id, url, caption, taken_at, client_ok, starred").eq("job_id", jobId)
      .gte("taken_at", `${period.start}T00:00:00-07:00`).lte("taken_at", `${period.end}T23:59:59-07:00`)
      .order("starred", { ascending: false }).order("taken_at", { ascending: false }).limit(40),
    pickedPhotoIds.length ? sb.from("job_photos").select("id, url, caption, taken_at, client_ok, starred").eq("job_id", jobId).in("id", pickedPhotoIds) : Promise.resolve({ data: [] }),
  ]);

  // The period's daily logs, ☆ items first.
  const keptInternal: KeptItem[] = [];
  const highlights: (ReturnType<typeof itemView> & { date: string })[] = [];
  const internalContext: { date: string; section: string; text: string }[] = [];
  const teamLogs: { date: string; log_number: number | null; status: string; items: ReturnType<typeof itemView>[] }[] = [];
  for (const l of (logs.data ?? []) as { id: string; log_date: string; log_number: number | null; status: string; sections: unknown }[]) {
    const s = normalizeSections(l.sections);
    if (client) {
      const { client: ok, internal } = clientSafeItems(s, addBack);
      for (const i of ok) highlights.push({ ...itemView(i), date: l.log_date });
      for (const i of internal) {
        keptInternal.push({ id: i.id, section: i.section, sectionLabel: SECTION_LABELS[i.section], text: i.section === "onsite" ? [i.company, i.trade].filter(Boolean).join(" – ") || i.text : i.text, date: l.log_date });
        internalContext.push({ date: l.log_date, section: SECTION_LABELS[i.section], text: i.text });
      }
    } else {
      teamLogs.push({ date: l.log_date, log_number: l.log_number, status: l.status, items: s.items.map(itemView) });
    }
  }
  highlights.sort((a, b) => Number(!!b.star) - Number(!!a.star));

  // Schedule: health, the next two weeks, contract milestones.
  type S = { title: string; kind: string; status: string; start_date: string | null; end_date: string | null; client_visible: boolean; contract_date: string | null; milestone_type: string | null };
  const all = (sched.data ?? []) as S[];
  const flagged = all.some((i) => i.client_visible);
  const items = client && flagged ? all.filter((i) => i.client_visible) : all;
  const lookEnd = addDays(period.end, 14);
  const lookahead = items.filter((i) => i.start_date && i.start_date > period.end && i.start_date <= lookEnd && i.status !== "complete")
    .slice(0, 12).map((i) => ({ item: i.title, start: i.start_date, end: i.kind === "milestone" ? null : i.end_date }));
  const completedInPeriod = items.filter((i) => i.status === "complete" && i.end_date && i.end_date >= period.start && i.end_date <= period.end).map((i) => i.title).slice(0, 12);
  const contract = items.filter((i) => i.contract_date).map((i) => ({ milestone: i.title, contract_date: i.contract_date, forecast: i.start_date }));

  type C = { co_number: string | null; title: string; status: string; amount: number | null; client_visible: boolean };
  const coRows = ((cos.data ?? []) as C[]).filter((c) => !client || c.client_visible);
  const pending = coRows.filter((c) => c.status === "pending_approval" || c.status === "submitted").map((c) => ({ number: c.co_number, title: c.title, ...(client ? {} : { amount: c.amount }) }));

  type I = { invoice_number: string | null; status: string; amount: number | null; amount_paid: number | null; due_date: string | null; created_at: string };
  const inv = (invoices.data ?? []) as I[];
  const billed = inv.filter((i) => i.status !== "draft" && i.status !== "void");
  const latest = [...billed].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  type Sel = { name: string; selection_status: string | null; approval_status: string | null; target_decision_date: string | null; client_visible: boolean | null };
  const decisionsDue = ((sels.data ?? []) as Sel[])
    .filter((s) => (!client || s.client_visible !== false) && s.approval_status !== "approved" && s.target_decision_date && s.target_decision_date >= t && s.target_decision_date <= addDays(t, 21))
    .sort((a, b) => String(a.target_decision_date).localeCompare(String(b.target_decision_date)))
    .map((s) => ({ selection: s.name, decide_by: s.target_decision_date }));

  // Library photos for the period (starred first) plus anything picked on the Photos page.
  type P = { id: string; url: string; caption: string | null; taken_at: string | null; client_ok: boolean; starred: boolean };
  const seen = new Set<string>();
  const photos: SummaryPhoto[] = [...((picked.data ?? []) as P[]), ...((lib.data ?? []) as P[])]
    .filter((p) => /^https:\/\//.test(p.url) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ id: p.id, url: p.url, caption: p.caption, date: p.taken_at ? p.taken_at.slice(0, 10) : null, clientVisible: p.client_ok }))
    .slice(0, 24);

  const data: Record<string, unknown> = {
    period,
    schedule_health: header ? { percent_complete: header.overall_progress, health: header.health, projected_completion: header.projected_completion, next_milestone: header.next_milestone } : null,
    schedule_completed_in_period: completedInPeriod,
    lookahead_two_weeks: lookahead,
    contract_milestones: contract,
    change_orders_pending_signature: pending,
    selections_decisions_due: decisionsDue,
  };
  if (client) {
    data.daily_log_highlights = highlights.slice(0, 40);
    data.internal_context_for_client_wording = internalContext.slice(0, 30);
  } else {
    data.field_reports = teamLogs;
    data.billing = { billed_to_date: billed.reduce((n, i) => n + (Number(i.amount) || 0), 0), paid_to_date: billed.reduce((n, i) => n + (Number(i.amount_paid) || 0), 0), latest: latest ? { number: latest.invoice_number, status: latest.status, amount: latest.amount, due: latest.due_date } : null, note: "There are no pay applications (G702) in CMI; this is invoices only." };
  }
  return { data, keptInternal, photos };
}
