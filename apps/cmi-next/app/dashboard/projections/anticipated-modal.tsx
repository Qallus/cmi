"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { cn, formatMoney } from "@/lib/utils";
import { PROJECTION_STATUS_META, type PipelineCandidate, type ProjectionStatus } from "@/lib/projections/types";

type StaffOption = { id: string; label: string };
type Form = {
  name: string; client_name: string; revenue: string; status: ProjectionStatus;
  forecast_start: string; forecast_finish: string; pm_staff_id: string; super_staff_id: string; notes: string;
  deal_id: string | null; opportunity_id: string | null; contact_id: string | null;
};

const EMPTY: Form = {
  name: "", client_name: "", revenue: "", status: "likely", forecast_start: "", forecast_finish: "",
  pm_staff_id: "", super_staff_id: "", notes: "", deal_id: null, opportunity_id: null, contact_id: null,
};

const fromCandidate = (c: PipelineCandidate): Form => ({
  ...EMPTY,
  name: c.name, client_name: c.client_name ?? "", revenue: c.value ? String(c.value) : "", status: c.status,
  forecast_start: c.start ?? "", forecast_finish: c.finish ?? "",
  pm_staff_id: c.pm_staff_id ?? "", super_staff_id: c.super_staff_id ?? "",
  deal_id: c.kind === "deal" ? c.id : null, opportunity_id: c.kind === "opportunity" ? c.id : null, contact_id: c.contact_id,
});

// Add work that isn't a job yet: typed in manually, or picked from the
// Pipeline (deal or Pre-Con opportunity) and prefilled. It relinks to the job
// automatically on Promote to Job.
export function AnticipatedModal({ mode, preselect, onClose, onCreated }: {
  mode: "manual" | "pipeline";
  preselect?: { kind: "deal" | "opportunity"; id: string } | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [candidates, setCandidates] = React.useState<PipelineCandidate[] | null>(mode === "pipeline" ? null : []);
  const [picked, setPicked] = React.useState<PipelineCandidate | null>(null);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [staff, setStaff] = React.useState<StaffOption[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/staff-options").then((r) => r.json()).then((j) => setStaff((j.staff ?? []).map((s: StaffOption) => ({ id: s.id, label: s.label })))).catch(() => {});
    if (mode !== "pipeline") return;
    let alive = true;
    fetch("/api/projections/pipeline-candidates")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load the Pipeline."); return j as PipelineCandidate[]; })
      .then((list) => {
        if (!alive) return;
        setCandidates(list);
        if (preselect) {
          const hit = list.find((c) => c.kind === preselect.kind && c.id === preselect.id);
          if (hit) { setPicked(hit); setForm(fromCandidate(hit)); }
          else setNotice("That record is already in Projections, has become a job, or isn't at an eligible stage.");
        }
      })
      .catch((e) => { if (alive) { setCandidates([]); setError((e as Error).message); } });
    return () => { alive = false; };
  }, [mode, preselect]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const showForm = mode === "manual" || picked !== null;

  async function submit() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/projections/anticipated", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, revenue: Number(form.revenue || 0) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add.");
      onCreated(json.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const title = mode === "pipeline" ? "Add from Pipeline" : "Add Anticipated Project";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="anticipated-title" className="relative z-10 flex h-[95vh] w-full max-w-[40rem] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="anticipated-title" className="font-semibold">{title}</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          {notice && <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{notice}</div>}

          {mode === "pipeline" && !picked && (
            candidates === null ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : candidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing to add. Deals from Qualified to Negotiation and open Pre-Con opportunities show here until they&apos;re in Projections or become jobs.
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Pick a deal or Pre-Con opportunity. You can adjust the value and dates before adding.</p>
                {candidates.map((c) => (
                  <button key={`${c.kind}-${c.id}`} type="button" onClick={() => { setPicked(c); setForm(fromCandidate(c)); }}
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.kind === "deal" ? "Deal" : "Pre-Con"} · {c.stage.replace(/_/g, " ")}{c.client_name ? ` · ${c.client_name}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums">{c.value ? formatMoney(c.value) : "No value"}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {showForm && (
            <>
              {picked && (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                  <span>From {picked.kind === "deal" ? "deal" : "Pre-Con opportunity"}: <span className="font-medium">{picked.name}</span></span>
                  {!preselect && <button type="button" className="text-accent hover:underline" onClick={() => { setPicked(null); setForm(EMPTY); }}>Change</button>}
                </div>
              )}
              <F label="Project name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Camelback Remodel" /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Client"><Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></F>
                <F label="Status">
                  <Select value={form.status} onChange={(e) => set("status", e.target.value as ProjectionStatus)}>
                    {(Object.keys(PROJECTION_STATUS_META) as ProjectionStatus[]).map((s) => <option key={s} value={s}>{PROJECTION_STATUS_META[s].label}</option>)}
                  </Select>
                </F>
              </div>
              <F label="Anticipated value">
                <MoneyInput value={form.revenue} onChange={(v) => set("revenue", v)} className="cmi-form-control h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-accent" />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Forecast start"><Input type="date" value={form.forecast_start} onChange={(e) => set("forecast_start", e.target.value)} /></F>
                <F label="Forecast finish"><Input type="date" value={form.forecast_finish} onChange={(e) => set("forecast_finish", e.target.value)} /></F>
              </div>
              <p className={cn("text-[11px]", form.forecast_start && form.forecast_finish ? "text-muted-foreground" : "text-yellow-800 dark:text-warning")}>
                {form.forecast_start && form.forecast_finish ? "The value is spread evenly across these months." : "Without both dates, nothing is spread yet — you can set dates later."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Project Manager">
                  <Select value={form.pm_staff_id} onChange={(e) => set("pm_staff_id", e.target.value)}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </F>
                <F label="Superintendent">
                  <Select value={form.super_staff_id} onChange={(e) => set("super_staff_id", e.target.value)}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </F>
              </div>
              <F label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[60px]" /></F>
            </>
          )}
        </div>
        {showForm && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="accent" disabled={busy || !form.name.trim()} onClick={() => void submit()}>{busy ? "Adding…" : "Add to Projections"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium">{label}</span>{children}</label>;
}
