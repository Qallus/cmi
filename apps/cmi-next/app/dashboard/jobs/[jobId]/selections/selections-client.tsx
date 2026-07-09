"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { ProjectSelection } from "@/lib/selections/types";
import { JobModuleShell, ModuleModal, Field, inputCls, money } from "../job-module-shell";

const SELECTION_STATUSES = ["draft", "needs_review", "pending_client_approval", "client_approved", "rejected_needs_revision", "approved_internally", "ordered", "delivered", "installed", "completed"];
const APPROVAL_STATUSES = ["not_required", "pending", "approved", "rejected", "revision_requested", "approved_with_changes"];
const APPROVAL_TONE: Record<string, "default" | "warning" | "success" | "danger"> = { not_required: "default", pending: "warning", approved: "success", rejected: "danger", revision_requested: "danger", approved_with_changes: "success" };

type Draft = {
  name: string; category: string; room_area_name: string; custom_product_name: string; description: string;
  image_url: string; product_url: string; client_price: string; allowance_amount: string; quantity: string;
  selection_status: string; approval_status: string; client_visible: boolean; client_approval_required: boolean;
};
const EMPTY: Draft = { name: "", category: "", room_area_name: "", custom_product_name: "", description: "", image_url: "", product_url: "", client_price: "", allowance_amount: "", quantity: "1", selection_status: "draft", approval_status: "not_required", client_visible: false, client_approval_required: false };

export function StaffSelectionsClient({ jobId, jobName, initial }: { jobId: string; jobName: string; initial: ProjectSelection[] }) {
  const [rows, setRows] = React.useState<ProjectSelection[]>(initial);
  const [modal, setModal] = React.useState<{ mode: "add" } | { mode: "edit"; sel: ProjectSelection } | null>(null);
  const [d, setD] = React.useState<Draft>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openAdd() { setD({ ...EMPTY }); setError(null); setModal({ mode: "add" }); }
  function openEdit(s: ProjectSelection) {
    setD({ name: s.name, category: s.category ?? "", room_area_name: s.room_area_name ?? "", custom_product_name: s.custom_product_name ?? "", description: s.description ?? "", image_url: s.image_url ?? "", product_url: s.product_url ?? "", client_price: s.client_price?.toString() ?? "", allowance_amount: s.allowance_amount?.toString() ?? "", quantity: s.quantity?.toString() ?? "1", selection_status: s.selection_status ?? "draft", approval_status: s.approval_status ?? "not_required", client_visible: s.client_visible, client_approval_required: s.client_approval_required });
    setError(null); setModal({ mode: "edit", sel: s });
  }

  async function save() {
    if (!d.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...d, client_price: d.client_price ? Number(d.client_price) : null, allowance_amount: d.allowance_amount ? Number(d.allowance_amount) : null, quantity: d.quantity ? Number(d.quantity) : 1 };
      const url = modal?.mode === "add" ? `/api/jobs/${jobId}/selections` : `/api/jobs/${jobId}/selections/${(modal as { sel: ProjectSelection }).sel.id}`;
      const res = await fetch(url, { method: modal?.mode === "add" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => (modal?.mode === "add" ? [j, ...r] : r.map((x) => (x.id === j.id ? j : x))));
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this selection?")) return;
    const res = await fetch(`/api/jobs/${jobId}/selections/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="selections" title="Selections"
      action={<Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Selection</Button>}>
      <p className="mb-3 text-sm text-muted-foreground">Mark a selection <strong>client-visible</strong> and <strong>needs approval</strong> (approval status “pending”) to request the client&apos;s sign-off — they&apos;ll be notified.</p>
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-card"><tr className="border-b border-border text-left">
          {["Selection", "Room", "Category", "Client Price", "Approval", "Client", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No selections yet.</td></tr>}
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.room_area_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.category ?? "—"}</td>
              <td className="px-4 py-3">{money(s.client_price)}</td>
              <td className="px-4 py-3"><Badge tone={APPROVAL_TONE[s.approval_status] ?? "default"}>{s.approval_status.replace(/_/g, " ")}</Badge></td>
              <td className="px-4 py-3">{s.client_visible ? <Badge tone="success">Visible</Badge> : <span className="text-xs text-muted-foreground">Hidden</span>}</td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(s)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button><button type="button" onClick={() => void remove(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <ModuleModal title={modal.mode === "add" ? "Add Selection" : "Edit Selection"} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><input className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
              <Field label="Room / Area"><input className={inputCls} value={d.room_area_name} onChange={(e) => setD({ ...d, room_area_name: e.target.value })} /></Field>
              <Field label="Category"><input className={inputCls} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} /></Field>
              <Field label="Product Name"><input className={inputCls} value={d.custom_product_name} onChange={(e) => setD({ ...d, custom_product_name: e.target.value })} /></Field>
              <Field label="Quantity"><input type="number" className={inputCls} value={d.quantity} onChange={(e) => setD({ ...d, quantity: e.target.value })} /></Field>
              <Field label="Image URL" className="sm:col-span-2"><input className={inputCls} value={d.image_url} onChange={(e) => setD({ ...d, image_url: e.target.value })} /></Field>
              <Field label="Product URL" className="sm:col-span-2"><input className={inputCls} value={d.product_url} onChange={(e) => setD({ ...d, product_url: e.target.value })} /></Field>
              <Field label="Client Price ($)"><input type="number" className={inputCls} value={d.client_price} onChange={(e) => setD({ ...d, client_price: e.target.value })} /></Field>
              <Field label="Allowance ($)"><input type="number" className={inputCls} value={d.allowance_amount} onChange={(e) => setD({ ...d, allowance_amount: e.target.value })} /></Field>
              <Field label="Selection Status"><Select value={d.selection_status} onChange={(e) => setD({ ...d, selection_status: e.target.value })}>{SELECTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</Select></Field>
              <Field label="Approval Status"><Select value={d.approval_status} onChange={(e) => setD({ ...d, approval_status: e.target.value })}>{APPROVAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</Select></Field>
            </div>
            <Field label="Description"><Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.client_visible} onChange={(e) => setD({ ...d, client_visible: e.target.checked })} /> Client visible</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.client_approval_required} onChange={(e) => setD({ ...d, client_approval_required: e.target.checked })} /> Requires client approval</label>
            </div>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
