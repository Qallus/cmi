"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Layers, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { ProjectSelection } from "@/lib/selections/types";
import { SelectionCardModal } from "@/components/selections/selection-card-modal";
import { JobModuleShell, ModuleModal, Field, inputCls, money } from "../job-module-shell";

const SELECTION_STATUSES = ["draft", "needs_review", "pending_client_approval", "client_approved", "rejected_needs_revision", "approved_internally", "ordered", "delivered", "installed", "completed"];
const APPROVAL_STATUSES = ["not_required", "pending", "approved", "rejected", "revision_requested", "approved_with_changes"];
const APPROVAL_TONE: Record<string, "default" | "warning" | "success" | "danger"> = { not_required: "default", pending: "warning", approved: "success", rejected: "danger", revision_requested: "danger", approved_with_changes: "success" };

type Draft = {
  name: string; category: string; room_area_name: string; custom_product_name: string; description: string;
  size: string; finish: string; colors: string;
  image_url: string; product_url: string; client_price: string; allowance_amount: string; quantity: string;
  selection_status: string; approval_status: string; client_visible: boolean; client_approval_required: boolean;
};
const EMPTY: Draft = { name: "", category: "", room_area_name: "", custom_product_name: "", description: "", size: "", finish: "", colors: "", image_url: "", product_url: "", client_price: "", allowance_amount: "", quantity: "1", selection_status: "draft", approval_status: "not_required", client_visible: false, client_approval_required: false };

export function StaffSelectionsClient({ jobId, jobName, initial }: { jobId: string; jobName: string; initial: ProjectSelection[] }) {
  const [rows, setRows] = React.useState<ProjectSelection[]>(initial);
  const [modal, setModal] = React.useState<{ mode: "add" } | { mode: "edit"; sel: ProjectSelection } | null>(null);
  const [d, setD] = React.useState<Draft>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateChoice, setShowCreateChoice] = React.useState(false);
  const [existingOpen, setExistingOpen] = React.useState(false);
  const [existingItems, setExistingItems] = React.useState<ProjectSelection[]>([]);
  const [existingLoading, setExistingLoading] = React.useState(false);
  const [existingSearch, setExistingSearch] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [attaching, setAttaching] = React.useState(false);
  const [viewing, setViewing] = React.useState<ProjectSelection | null>(null);

  const onJob = React.useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const filteredExisting = React.useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    if (!q) return existingItems;
    return existingItems.filter((s) => [s.name, s.vendor_name, s.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [existingItems, existingSearch]);

  function openExisting() {
    setExistingOpen(true); setPicked(new Set()); setExistingSearch(""); setExistingLoading(true); setError(null);
    fetch(`/api/jobs/${jobId}/selections/attach`)
      .then((r) => r.json())
      .then((j) => setExistingItems(j.selections ?? []))
      .catch(() => setExistingItems([]))
      .finally(() => setExistingLoading(false));
  }
  function togglePick(id: string) {
    setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function attach() {
    if (picked.size === 0) return;
    setAttaching(true); setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/selections/attach`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selection_ids: Array.from(picked) }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => { const map = new Map(r.map((x) => [x.id, x])); for (const s of j.attached ?? []) map.set(s.id, s); return Array.from(map.values()); });
      setExistingOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not attach selections."); } finally { setAttaching(false); }
  }

  function openAdd() { setD({ ...EMPTY }); setError(null); setShowCreateChoice(false); setModal({ mode: "add" }); }
  function openEdit(s: ProjectSelection) {
    setD({ name: s.name, category: s.category ?? "", room_area_name: s.room_area_name ?? "", custom_product_name: s.custom_product_name ?? "", description: s.description ?? "", size: s.size ?? "", finish: s.finish ?? "", colors: s.colors ?? "", image_url: s.image_url ?? "", product_url: s.product_url ?? "", client_price: s.client_price?.toString() ?? "", allowance_amount: s.allowance_amount?.toString() ?? "", quantity: s.quantity?.toString() ?? "1", selection_status: s.selection_status ?? "draft", approval_status: s.approval_status ?? "not_required", client_visible: s.client_visible, client_approval_required: s.client_approval_required });
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
  async function duplicate(s: ProjectSelection) {
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/selections/${s.id}/duplicate`, { method: "POST" });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => [j, ...r]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not duplicate."); }
  }

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="selections" title="Selections"
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openExisting}><Layers className="h-3.5 w-3.5" /> Add Existing</Button>
          <Button size="sm" variant="accent" onClick={() => setShowCreateChoice(true)}><Plus className="h-3.5 w-3.5" /> Create New</Button>
        </div>
      }>
      <p className="mb-3 text-sm text-muted-foreground">Click a selection name to preview its card. Mark a selection <strong>client-visible</strong> and <strong>needs approval</strong> (approval status “pending”) to request the client&apos;s sign-off — they&apos;ll be notified.</p>
      {viewing && <SelectionCardModal selection={viewing} onClose={() => setViewing(null)} />}
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-card"><tr className="border-b border-border text-left">
          {["Selection", "Room", "Category", "Client Price", "Approval", "Client", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No selections yet.</td></tr>}
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">
                <button type="button" onClick={() => setViewing(s)} className="text-left hover:text-accent hover:underline">{s.name}</button>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{s.room_area_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.category ?? "—"}</td>
              <td className="px-4 py-3">{money(s.client_price)}</td>
              <td className="px-4 py-3"><Badge tone={APPROVAL_TONE[s.approval_status] ?? "default"}>{s.approval_status.replace(/_/g, " ")}</Badge></td>
              <td className="px-4 py-3">{s.client_visible ? <Badge tone="success">Visible</Badge> : <span className="text-xs text-muted-foreground">Hidden</span>}</td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(s)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button><button type="button" onClick={() => void duplicate(s)} className="text-muted-foreground hover:text-accent" title="Duplicate"><Copy className="h-4 w-4" /></button><button type="button" onClick={() => void remove(s.id)} className="text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
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
              <Field label="Size"><input className={inputCls} value={d.size} onChange={(e) => setD({ ...d, size: e.target.value })} placeholder={'24" x 48"'} /></Field>
              <Field label="Finish"><input className={inputCls} value={d.finish} onChange={(e) => setD({ ...d, finish: e.target.value })} placeholder="Matte / Polished" /></Field>
              <Field label="Colors" className="sm:col-span-2"><input className={inputCls} value={d.colors} onChange={(e) => setD({ ...d, colors: e.target.value })} placeholder="Limo, Melange, Sabbia" /></Field>
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

      {showCreateChoice && (
        <ModuleModal title="Create New Selection" onClose={() => setShowCreateChoice(false)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Build a card from a vendor page, or enter details by hand. Either way it&apos;s attached to this job.</p>
            <Link href={`/dashboard/selections/live-builder?job=${jobId}`} className="flex items-start gap-3 rounded-lg border border-border p-4 transition hover:border-accent hover:bg-accent/5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div><div className="font-semibold">Live Selection Builder</div><p className="text-sm text-muted-foreground">Review a vendor page and build a Selection Card from its content.</p></div>
            </Link>
            <button type="button" onClick={openAdd} className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition hover:border-accent hover:bg-accent/5">
              <Plus className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div><div className="font-semibold">Manual Selection</div><p className="text-sm text-muted-foreground">Enter product and selection details manually.</p></div>
            </button>
          </div>
        </ModuleModal>
      )}

      {existingOpen && (
        <ModuleModal title="Add Existing Selection" onClose={() => setExistingOpen(false)} wide>
          <div className="space-y-3">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inputCls} pl-9`} placeholder="Search selections…" value={existingSearch} onChange={(e) => setExistingSearch(e.target.value)} />
            </div>
            <div className="max-h-[52vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {existingLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : filteredExisting.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No selections found.</div>
              ) : filteredExisting.map((s) => {
                const already = onJob.has(s.id);
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${already ? "opacity-60" : "hover:bg-muted/40"}`}>
                    <input type="checkbox" disabled={already} checked={already || picked.has(s.id)} onChange={() => togglePick(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
                    {s.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.image_url} alt="" className="h-9 w-9 shrink-0 rounded border border-border object-cover" />
                      : <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-muted text-muted-foreground"><Layers className="h-4 w-4" /></span>}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{s.name}</div><div className="truncate text-xs text-muted-foreground">{[s.vendor_name, s.category].filter(Boolean).join(" · ") || "—"}</div></div>
                    <div className="shrink-0 text-xs text-muted-foreground">{money(s.client_price)}</div>
                    {already && <Badge tone="success">On this job</Badge>}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{picked.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setExistingOpen(false)}>Cancel</Button>
                <Button size="sm" variant="accent" disabled={picked.size === 0 || attaching} onClick={() => void attach()}>
                  {attaching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Add {picked.size || ""} to job
                </Button>
              </div>
            </div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
