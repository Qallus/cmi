"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { cn, formatMoney } from "@/lib/utils";
import { monthLabel } from "@/lib/projections/calc";
import { formatDate } from "../jobs/job-ui";
import { PROJECTION_STATUS_META, type ProjectionDetail, type ProjectionStatus } from "@/lib/projections/types";

type StaffOption = { id: string; label: string };

type Form = {
  status: string;
  revenue: string;
  start: string;
  finish: string;
  pm: string;
  sup: string;
  include: boolean;
  notes: string;
};

const toForm = (d: ProjectionDetail): Form => ({
  status: d.overrides.status ?? "",
  revenue: d.overrides.revenue_override === null ? "" : String(d.overrides.revenue_override),
  start: d.overrides.forecast_start ?? "",
  finish: d.overrides.forecast_finish ?? "",
  pm: d.overrides.pm_staff_id ?? "",
  sup: d.overrides.super_staff_id ?? "",
  include: d.overrides.include,
  notes: d.overrides.notes ?? "",
});

// Right-side slide-over for one projection: official vs forecast values,
// overrides, month history and the audit log.
export function ProjectionDetailPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = React.useState<ProjectionDetail | null>(null);
  const [form, setForm] = React.useState<Form | null>(null);
  const [staff, setStaff] = React.useState<StaffOption[]>([]);
  const [respread, setRespread] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const apply = React.useCallback((d: ProjectionDetail) => { setDetail(d); setForm(toForm(d)); setRespread(false); }, []);

  React.useEffect(() => {
    // Mounted per projection (keyed by id), so no reset is needed here.
    let alive = true;
    fetch(`/api/projections/${id}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load projection."); return j as ProjectionDetail; })
      .then((d) => { if (alive) apply(d); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [id, apply]);

  React.useEffect(() => {
    fetch("/api/staff-options").then((r) => r.json()).then((j) => setStaff((j.staff ?? []).map((s: { id: string; label: string }) => ({ id: s.id, label: s.label })))).catch(() => {});
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initial = detail ? toForm(detail) : null;
  const dirty = !!(form && initial) && (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== initial[k]);
  const spreadDirty = !!(form && initial) && (form.start !== initial.start || form.finish !== initial.finish || form.revenue !== initial.revenue);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
    // Changing dates or revenue usually means the spread should follow.
    if (key === "start" || key === "finish" || key === "revenue") setRespread(true);
  }

  async function save() {
    if (!form || !initial) return;
    setBusy(true); setError(null);
    const body: Record<string, unknown> = {};
    if (form.status !== initial.status) body.status = form.status || null;
    if (form.revenue !== initial.revenue) body.revenue_override = form.revenue === "" ? null : Number(form.revenue);
    if (form.start !== initial.start) body.forecast_start = form.start || null;
    if (form.finish !== initial.finish) body.forecast_finish = form.finish || null;
    if (form.pm !== initial.pm) body.pm_staff_id = form.pm || null;
    if (form.sup !== initial.sup) body.super_staff_id = form.sup || null;
    if (form.include !== initial.include) body.include = form.include;
    if (form.notes !== initial.notes) body.notes = form.notes;
    if (respread) body.respread = true;
    try {
      const res = await fetch(`/api/projections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      apply(json);
      setSaved(true);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this project from Projections? The job isn't changed, and adding it again restores its forecast history.")) return;
    setBusy(true);
    const res = await fetch(`/api/projections/${id}`, { method: "DELETE" });
    if (res.ok) { onChanged(); onClose(); } else { setError((await res.json().catch(() => ({}))).error ?? "Could not remove."); setBusy(false); }
  }

  const row = detail?.row;
  const official = detail?.official;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="projection-detail-title" className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Projection</div>
            <h2 id="projection-detail-title" className="truncate text-lg font-semibold">{row?.name ?? "Loading…"}</h2>
            {row && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{[row.job_number, row.client_name].filter(Boolean).join(" · ")}</span>
                {row.job_id && <Link href={`/dashboard/jobs/${row.job_id}/summary`} className="inline-flex shrink-0 items-center gap-1 text-accent hover:underline">Open job <ExternalLink className="h-3 w-3" /></Link>}
              </div>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {!detail || !form || !row || !official ? (
            !error && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Total" value={formatMoney(row.total_revenue)} />
                <Stat label="Billed" value={row.has_actuals ? formatMoney(row.billed_to_date) : "—"} />
                <Stat label="Remaining" value={formatMoney(row.remaining)} />
              </div>
              <div className="-mt-3 text-center text-[11px] text-muted-foreground">
                {row.allocation === "balanced" ? "Remaining revenue is fully forecast." : row.allocation === "under" ? `${formatMoney(row.unallocated)} of remaining revenue isn't forecast in any month yet.` : `Future forecast is ${formatMoney(-row.unallocated)} more than what's remaining.`}
              </div>

              <section className="space-y-3">
                <SectionTitle>Forecast</SectionTitle>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.include} onChange={(e) => update("include", e.target.checked)} />
                  Include in totals
                </label>
                <Field label="Status" hint={official.status ? `Job: ${PROJECTION_STATUS_META[official.status].label}` : undefined}>
                  <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
                    <option value="">{official.status ? `From job (${PROJECTION_STATUS_META[official.status].label})` : "Default (Likely)"}</option>
                    {(Object.keys(PROJECTION_STATUS_META) as ProjectionStatus[]).map((s) => <option key={s} value={s}>{PROJECTION_STATUS_META[s].label}</option>)}
                  </Select>
                </Field>
                <Field label="Revenue" hint={`Official: ${formatMoney(official.revenue)} (contract + approved change orders). Leave blank to use it.`}>
                  <div className="flex items-center gap-2">
                    <MoneyInput value={form.revenue} onChange={(v) => update("revenue", v)} placeholder={official.revenue === null ? "$0.00" : formatMoney(official.revenue)} className="cmi-form-control h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-accent" />
                    {form.revenue !== "" && <Button size="sm" variant="ghost" onClick={() => update("revenue", "")}>Use official</Button>}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Forecast start" hint={`Job: ${formatDate(official.start)}`}>
                    <Input type="date" value={form.start} onChange={(e) => update("start", e.target.value)} />
                  </Field>
                  <Field label="Forecast finish" hint={`Job: ${formatDate(official.finish)}`}>
                    <Input type="date" value={form.finish} onChange={(e) => update("finish", e.target.value)} />
                  </Field>
                </div>
                {(form.start || form.finish) && (
                  <button type="button" className="text-[11px] text-accent hover:underline" onClick={() => { update("start", ""); update("finish", ""); }}>Use job dates</button>
                )}
                <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={respread} onChange={(e) => setRespread(e.target.checked)} />
                  <span>
                    Respread remaining revenue evenly across the forecast dates when saving.
                    <span className="block text-muted-foreground">Past months keep their amounts; future months are replaced.{spreadDirty && !respread ? " Dates or revenue changed — without this, the month amounts stay as they are." : ""}</span>
                  </span>
                </label>
              </section>

              <section className="space-y-3">
                <SectionTitle>Team</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Project Manager">
                    <Select value={form.pm} onChange={(e) => update("pm", e.target.value)}>
                      <option value="">{`From job (${official.pms.join(", ") || "none"})`}</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Superintendent">
                    <Select value={form.sup} onChange={(e) => update("sup", e.target.value)}>
                      <option value="">{`From job (${official.supers.join(", ") || "none"})`}</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                  </Field>
                </div>
                <p className="text-[11px] text-muted-foreground">Overrides apply to Projections only. Change the job&apos;s official team in Job Info → Internal Users.</p>
              </section>

              <section className="space-y-2">
                <SectionTitle>Notes</SectionTitle>
                <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className="min-h-[70px]" placeholder="Forecast assumptions, risks…" />
              </section>

              <section className="space-y-2">
                <SectionTitle>Months</SectionTitle>
                {detail.months.length === 0 || detail.months.every((m) => !m.projected && !m.actual && m.original === null) ? (
                  <p className="text-xs text-muted-foreground">No months forecast yet. Set dates and respread, or type amounts in the grid.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1 text-left font-medium">Month</th>
                        <th className="py-1 text-right font-medium">Original</th>
                        <th className="py-1 text-right font-medium">Forecast</th>
                        <th className="py-1 text-right font-medium">Actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.months.map((m) => (
                        <tr key={m.month} className={cn(m.month === detail.currentMonth && "bg-accent/10")}>
                          <td className="py-1">{monthLabel(m.month)}</td>
                          <td className="py-1 text-right tabular-nums text-muted-foreground">{m.original === null ? "—" : formatMoney(m.original)}</td>
                          <td className={cn("py-1 text-right tabular-nums", m.original !== null && m.original !== m.projected && "font-semibold text-accent")}>{formatMoney(m.projected)}</td>
                          <td className="py-1 text-right tabular-nums">{row.has_actuals && m.month <= detail.currentMonth ? formatMoney(m.actual) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="space-y-2">
                <SectionTitle>History</SectionTitle>
                {detail.activity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No changes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.activity.map((a) => (
                      <li key={a.id} className="text-xs">
                        <div>{describeActivity(a)}</div>
                        <div className="text-[11px] text-muted-foreground">{a.actor_name ?? "System"} · {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        {detail && form && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void remove()}>Remove from Projections</Button>
            <div className="flex items-center gap-2">
              {saved && !dirty && <Badge tone="success" className="h-6">Saved</Badge>}
              <Button size="sm" variant="accent" disabled={busy || (!dirty && !respread)} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-2 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h3>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const FIELD_LABELS: Record<string, string> = {
  status: "status", revenue_override: "revenue", forecast_start: "start", forecast_finish: "finish",
  pm_staff_id: "PM", super_staff_id: "superintendent", include: "include", notes: "notes",
};

function describeActivity(a: ProjectionDetail["activity"][number]): string {
  const d = a.detail ?? {};
  switch (a.action) {
    case "added":
      return `Added to Projections — ${formatMoney(Number(d.total ?? 0) - Number(d.billed ?? 0))} spread over ${d.months ?? 0} month${d.months === 1 ? "" : "s"}`;
    case "restored":
      return "Restored to Projections";
    case "removed":
      return "Removed from Projections";
    case "month_edited":
      return `${monthLabel(String(d.month))}: ${formatMoney(Number(d.before ?? 0))} → ${formatMoney(Number(d.after ?? 0))} (${d.mode === "redistribute" ? "rest redistributed" : "this month only"})`;
    case "respread":
      return `Respread ${formatMoney(Number(d.remaining ?? 0))} over ${monthLabel(String(d.from))} – ${monthLabel(String(d.to))}`;
    case "updated": {
      const after = (d.after ?? {}) as Record<string, unknown>;
      const keys = Object.keys(after).map((k) => FIELD_LABELS[k] ?? k);
      return keys.length ? `Changed ${keys.join(", ")}` : "Updated";
    }
    default:
      return a.action;
  }
}
