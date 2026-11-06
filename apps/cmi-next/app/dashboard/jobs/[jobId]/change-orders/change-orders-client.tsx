"use client";

import * as React from "react";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input, Textarea } from "@/components/ui/input";
import { CHANGE_ORDER_STATUSES } from "@/lib/change-orders/types";
import type { ChangeOrder, ChangeOrderStatus, ChangeOrderDraft } from "@/lib/change-orders/types";
import { JobModuleShell, ModuleModal, Field, inputCls, money, fmtDate } from "../job-module-shell";

// What an approval did to the schedule (Phase 2 Step 4), so the PM can take a new baseline.
type Extension = { days: number; moved: { item_id: string; title: string; from: string; to: string }[]; scheduleIds: string[] };

const TONES: Record<ChangeOrderStatus, "default" | "warning" | "info" | "success" | "danger"> = {
  draft: "default", submitted: "info", pending_approval: "warning", approved: "success", rejected: "danger", void: "default",
};

type Modal = { mode: "add" } | { mode: "edit"; co: ChangeOrder } | null;
const EMPTY: ChangeOrderDraft = { title: "", description: "", status: "draft", amount: 0, co_date: "", requested_by: "", client_visible: false, schedule_days: null };

export function ChangeOrdersClient({ jobId, jobName, initial }: { jobId: string; jobName: string; initial: ChangeOrder[] }) {
  const [rows, setRows] = React.useState<ChangeOrder[]>(initial);
  const [modal, setModal] = React.useState<Modal>(null);
  const [draft, setDraft] = React.useState<ChangeOrderDraft>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Schedule days only do something with progress tracking on (flag schedule_progress).
  const [scheduleDays, setScheduleDays] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/flags").then((r) => r.json()).then((d: { flags?: Record<string, boolean> }) => setScheduleDays(!!d.flags?.schedule_progress)).catch(() => {});
  }, []);
  const [extended, setExtended] = React.useState<(Extension & { co: string }) | null>(null);
  const [baselining, setBaselining] = React.useState<"idle" | "busy" | "done">("idle");

  const approvedTotal = rows.filter((r) => r.status === "approved").reduce((s, r) => s + (r.amount ?? 0), 0);

  function openAdd() { setDraft({ ...EMPTY, co_date: new Date().toISOString().slice(0, 10) }); setError(null); setModal({ mode: "add" }); }
  function openEdit(co: ChangeOrder) {
    setDraft({ title: co.title, description: co.description ?? "", status: co.status, amount: co.amount ?? 0, co_date: co.co_date ?? "", requested_by: co.requested_by ?? "", client_visible: co.client_visible, schedule_days: co.schedule_days ?? null });
    setError(null); setModal({ mode: "edit", co });
  }

  async function save() {
    if (!draft.title?.trim()) { setError("Title is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload: ChangeOrderDraft = { ...draft, amount: draft.amount ? Number(draft.amount) : 0, co_date: draft.co_date || null };
      if (!scheduleDays) delete payload.schedule_days;
      let saved: (ChangeOrder & { extension?: Extension | null }) | null = null;
      if (modal?.mode === "add") {
        const res = await fetch(`/api/jobs/${jobId}/change-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const j = await res.json(); if (!res.ok) throw new Error(j.error);
        setRows((r) => [j, ...r]); saved = j;
      } else if (modal?.mode === "edit") {
        const res = await fetch(`/api/jobs/${jobId}/change-orders/${modal.co.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const j = await res.json(); if (!res.ok) throw new Error(j.error);
        setRows((r) => r.map((x) => (x.id === j.id ? j : x))); saved = j;
      }
      if (saved?.extension) { setExtended({ ...saved.extension, co: saved.co_number ?? saved.title }); setBaselining("idle"); }
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }
  async function newBaselines() {
    if (!extended) return;
    setBaselining("busy");
    const reason = `${extended.co}: ${extended.days > 0 ? "+" : ""}${extended.days} working days`;
    const results = await Promise.all(extended.scheduleIds.map((id) => fetch(`/api/schedules/${id}/baselines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "", reason }) })));
    setBaselining(results.every((r) => r.ok) ? "done" : "idle");
    if (!results.every((r) => r.ok)) setError("Couldn't capture every baseline. Try again from the schedule.");
  }
  async function remove(id: string) {
    if (!confirm("Delete this change order?")) return;
    const res = await fetch(`/api/jobs/${jobId}/change-orders/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="change-orders" title="Change Orders"
      action={<Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Change Order</Button>}>
      {extended ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="font-medium">{extended.co} approved: {extended.days > 0 ? "+" : ""}{extended.days} working day{Math.abs(extended.days) === 1 ? "" : "s"}.</span>{" "}
            {extended.moved.length
              ? <span className="text-muted-foreground">Contract dates moved: {extended.moved.map((m) => `${m.title} ${fmtDate(m.from)} → ${fmtDate(m.to)}`).join("; ")}.</span>
              : <span className="text-muted-foreground">No open contract milestones to move; the extension is recorded.</span>}
          </div>
          {extended.scheduleIds.length ? (
            baselining === "done"
              ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">New baseline captured.</span>
              : <Button size="sm" variant="accent" disabled={baselining === "busy"} onClick={() => void newBaselines()}>{baselining === "busy" ? "Capturing…" : "Capture new baseline"}</Button>
          ) : null}
          <button type="button" onClick={() => setExtended(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      ) : null}
      <div className="mb-3 text-sm text-muted-foreground">Approved total: <span className="font-semibold text-foreground">{money(approvedTotal)}</span> · flows into the Job Price Summary.</div>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-card"><tr className="border-b border-border text-left">
          {["CO #", "Title", "Amount", "Status", "Date", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No change orders yet.</td></tr>}
          {rows.map((co) => (
            <tr key={co.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{co.co_number}</td>
              <td className="px-4 py-3 font-medium">{co.title}</td>
              <td className="px-4 py-3">{money(co.amount)}</td>
              <td className="px-4 py-3"><Badge tone={TONES[co.status]}>{co.status.replace(/_/g, " ")}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(co.co_date)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <a href={`/api/jobs/${jobId}/change-orders/${co.id}/pdf`} target="_blank" rel="noreferrer" title="Download PDF" className="text-muted-foreground hover:text-foreground"><Download className="h-4 w-4" /></a>
                  <button type="button" onClick={() => openEdit(co)} className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void remove(co.id)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <ModuleModal title={modal.mode === "add" ? "Add Change Order" : `Edit ${modal.co.co_number}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <Field label="Title"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amount ($)"><input type="number" className={inputCls} value={draft.amount ?? ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value ? Number(e.target.value) : 0 })} /></Field>
              <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ChangeOrderStatus })}>{CHANGE_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</Select></Field>
              <Field label="CO Date"><Input type="date" value={draft.co_date ?? ""} onChange={(e) => setDraft({ ...draft, co_date: e.target.value })} /></Field>
              <Field label="Requested By"><input className={inputCls} value={draft.requested_by ?? ""} onChange={(e) => setDraft({ ...draft, requested_by: e.target.value })} /></Field>
              {scheduleDays ? (
                <Field label="Schedule days (working days)">
                  <input type="number" step={1} className={inputCls} value={draft.schedule_days ?? ""} placeholder="0"
                    onChange={(e) => setDraft({ ...draft, schedule_days: e.target.value === "" ? null : Math.round(Number(e.target.value)) })} />
                  <span className="mt-1 block text-[11px] text-muted-foreground">When approved, moves the job&apos;s open contract dates by this many working days (once).</span>
                </Field>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.client_visible} onChange={(e) => setDraft({ ...draft, client_visible: e.target.checked })} /> Visible to client</label>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
