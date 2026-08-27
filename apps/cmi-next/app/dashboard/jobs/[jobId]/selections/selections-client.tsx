"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Columns3, Copy, Download, FileText, Image as ImageIcon, Layers, LayoutGrid, List as ListIcon, Loader2, Pencil, Plus, Search, Sparkles, Table as TableIcon, Trash2 } from "lucide-react";
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
  const [view, setView] = React.useState<"list" | "table" | "kanban" | "cards" | "calendar">("table");

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
      {viewing && <SelectionCardModal selection={viewing} onClose={() => setViewing(null)} />}

      {/* View toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Click a selection to preview its card. Mark one <strong>client-visible</strong> + approval <strong>pending</strong> to request the client&apos;s sign-off.</p>
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5">
          {([["list", ListIcon, "List"], ["table", TableIcon, "Table"], ["kanban", Columns3, "Kanban"], ["cards", LayoutGrid, "Cards"], ["calendar", CalendarDays, "Calendar"]] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" title={label} onClick={() => setView(v)} className={`rounded p-1.5 transition ${view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No selections yet.</div>
      ) : (() => {
        const a: SelActions = { onView: setViewing, onEdit: openEdit, onDuplicate: (s) => void duplicate(s), onDelete: (s) => void remove(s.id), onCsv: csvOne, onPrint: printOne };
        if (view === "list") return <SelList rows={rows} a={a} />;
        if (view === "kanban") return <SelKanban rows={rows} a={a} />;
        if (view === "cards") return <SelCards rows={rows} a={a} />;
        if (view === "calendar") return <SelCalendar rows={rows} a={a} />;
        return <SelTable rows={rows} a={a} />;
      })()}

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

// ─── Views ─────────────────────────────────────────────────────
type SelActions = {
  onView: (s: ProjectSelection) => void;
  onEdit: (s: ProjectSelection) => void;
  onDuplicate: (s: ProjectSelection) => void;
  onDelete: (s: ProjectSelection) => void;
  onCsv: (s: ProjectSelection) => void;
  onPrint: (s: ProjectSelection) => void;
};

function esc(v: unknown) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function csvOne(s: ProjectSelection) {
  const pairs: [string, string][] = [
    ["Name", s.name], ["Vendor", s.vendor_name ?? ""], ["Category", s.category ?? ""], ["Room", s.room_area_name ?? ""],
    ["Size", s.size ?? ""], ["Finish", s.finish ?? ""], ["Colors", s.colors ?? ""], ["SKU", s.sku ?? ""], ["Model", s.model_number ?? ""],
    ["Client Price", s.client_price?.toString() ?? ""], ["Approval", s.approval_status], ["Description", s.description ?? ""],
    ["Source URL", s.source_url ?? s.product_url ?? ""],
  ];
  const csv = pairs.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a"); link.href = url; link.download = `${s.name || "selection"}.csv`; link.click(); URL.revokeObjectURL(url);
}

function printOne(s: ProjectSelection) {
  const w = window.open("", "_blank", "width=820,height=1040"); if (!w) return;
  const feats = (Array.isArray(s.features) ? s.features : []).map((f) => `<li>${esc(String(f))}</li>`).join("");
  const price = s.client_price != null ? `$${Number(s.client_price).toLocaleString()}` : "";
  const specs = ([["Size", s.size], ["Finish", s.finish], ["Colors", s.colors]] as [string, string | null | undefined][]).filter(([, v]) => v).map(([k, v]) => `<div><b>${k}:</b> ${esc(v)}</div>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.name)}</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;margin:44px;color:#1b1815;max-width:680px}h1{font-family:Georgia,serif;margin:6px 0}img{max-width:100%;border-radius:10px}.ey{text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#a9611e;font-weight:700}.muted{color:#666}.price{font-size:22px;font-weight:700;margin:10px 0}ul{padding-left:18px}</style>
    </head><body>
    ${s.image_url ? `<img src="${esc(s.image_url)}"/>` : ""}
    ${s.category ? `<div class="ey">${esc(s.category)}</div>` : ""}
    <h1>${esc(s.name)}</h1>
    <div class="muted">${esc([s.vendor_name, s.model_number || s.sku].filter(Boolean).join(" · "))}</div>
    ${price ? `<div class="price">${price}${s.unit ? ` <span class="muted" style="font-size:14px">/ ${esc(s.unit)}</span>` : ""}</div>` : ""}
    ${s.description ? `<p>${esc(s.description)}</p>` : ""}
    ${specs ? `<div style="margin:10px 0">${specs}</div>` : ""}
    ${feats ? `<ul>${feats}</ul>` : ""}
    </body></html>`);
  w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 350);
}

function RowActions({ s, a }: { s: ProjectSelection; a: SelActions }) {
  const btn = "rounded p-1 text-muted-foreground transition";
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" title="Edit" onClick={() => a.onEdit(s)} className={`${btn} hover:text-foreground`}><Pencil className="h-3.5 w-3.5" /></button>
      <button type="button" title="Duplicate" onClick={() => a.onDuplicate(s)} className={`${btn} hover:text-accent`}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" title="Download CSV" onClick={() => a.onCsv(s)} className={`${btn} hover:text-foreground`}><Download className="h-3.5 w-3.5" /></button>
      <button type="button" title="Print / PDF" onClick={() => a.onPrint(s)} className={`${btn} hover:text-foreground`}><FileText className="h-3.5 w-3.5" /></button>
      <button type="button" title="Delete" onClick={() => a.onDelete(s)} className={`${btn} hover:text-destructive`}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function Thumb({ s, onView, big }: { s: ProjectSelection; onView: (s: ProjectSelection) => void; big?: boolean }) {
  const sz = big ? "h-12 w-12" : "h-10 w-10";
  return (
    <button type="button" onClick={() => onView(s)} className="shrink-0" title="Preview card">
      {s.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={s.image_url} alt="" className={`${sz} rounded-full border border-border object-cover`} />
        : <span className={`grid ${sz} place-items-center rounded-full border border-border bg-muted text-muted-foreground`}><ImageIcon className="h-4 w-4" /></span>}
    </button>
  );
}

function ApprovalPill({ s }: { s: ProjectSelection }) {
  return <Badge tone={APPROVAL_TONE[s.approval_status] ?? "default"}>{s.approval_status.replace(/_/g, " ")}</Badge>;
}

function SelList({ rows, a }: { rows: ProjectSelection[]; a: SelActions }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {rows.map((s) => (
        <div key={s.id} className="flex items-center gap-4 px-4 py-3 transition hover:bg-muted/40">
          <Thumb s={s} onView={a.onView} big />
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => a.onView(s)} className="block max-w-full truncate text-left font-medium hover:text-accent hover:underline">{s.name}</button>
            <div className="truncate text-xs text-muted-foreground">{[s.vendor_name, s.category, s.room_area_name].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div className="hidden w-24 shrink-0 text-right text-sm font-semibold sm:block">{money(s.client_price)}</div>
          <div className="hidden shrink-0 md:block"><ApprovalPill s={s} /></div>
          <RowActions s={s} a={a} />
        </div>
      ))}
    </div>
  );
}

function SelTable({ rows, a }: { rows: ProjectSelection[]; a: SelActions }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-muted/40"><tr className="border-b border-border text-left">
          {["Selection", "Room", "Category", "Client Price", "Approval", "Client", "Actions"].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <td className="px-4 py-3"><div className="flex items-center gap-3"><Thumb s={s} onView={a.onView} /><button type="button" onClick={() => a.onView(s)} className="min-w-0 truncate text-left font-medium hover:text-accent hover:underline">{s.name}</button></div></td>
              <td className="px-4 py-3 text-muted-foreground">{s.room_area_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.category ?? "—"}</td>
              <td className="px-4 py-3">{money(s.client_price)}</td>
              <td className="px-4 py-3"><ApprovalPill s={s} /></td>
              <td className="px-4 py-3">{s.client_visible ? <Badge tone="success">Visible</Badge> : <span className="text-xs text-muted-foreground">Hidden</span>}</td>
              <td className="px-4 py-3"><RowActions s={s} a={a} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelCards({ rows, a }: { rows: ProjectSelection[]; a: SelActions }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((s) => (
        <div key={s.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          <button type="button" onClick={() => a.onView(s)} className="flex h-40 items-center justify-center overflow-hidden border-b border-border bg-muted/30" title="Preview card">
            {s.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.image_url} alt="" className="h-full w-full object-cover" />
              : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          </button>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => a.onView(s)} className="min-w-0 truncate text-left font-medium hover:text-accent hover:underline">{s.name}</button>
              {s.client_visible ? <Badge tone="success">Visible</Badge> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">{[s.vendor_name, s.category].filter(Boolean).join(" · ") || "—"}</div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="text-sm font-semibold">{money(s.client_price)}</span>
              <ApprovalPill s={s} />
            </div>
            <div className="border-t border-border pt-2"><RowActions s={s} a={a} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SelKanban({ rows, a }: { rows: ProjectSelection[]; a: SelActions }) {
  const cols = SELECTION_STATUSES.map((st) => ({ st, items: rows.filter((r) => (r.selection_status || "draft") === st) })).filter((c) => c.items.length > 0);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cols.map((col) => (
        <div key={col.st} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold capitalize">{col.st.replace(/_/g, " ")}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {col.items.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-background p-2.5">
                <div className="flex items-center gap-2">
                  <Thumb s={s} onView={a.onView} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => a.onView(s)} className="block max-w-full truncate text-left text-sm font-medium hover:text-accent hover:underline">{s.name}</button>
                    <div className="truncate text-[11px] text-muted-foreground">{s.vendor_name || "—"} · {money(s.client_price)}</div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end"><RowActions s={s} a={a} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SelCalendar({ rows, a }: { rows: ProjectSelection[]; a: SelActions }) {
  const dated = rows.map((s) => ({ s, date: s.target_install_date || s.target_delivery_date || s.target_decision_date || null }));
  const withDate = dated.filter((x): x is { s: ProjectSelection; date: string } => !!x.date);
  const undated = dated.filter((x) => !x.date).map((x) => x.s);
  const groups = new Map<string, ProjectSelection[]>();
  for (const { s, date } of withDate) groups.set(date, [...(groups.get(date) ?? []), s]);
  const sortedDates = [...groups.keys()].sort();
  const fmt = (d: string) => { const dt = new Date(`${d}T00:00:00`); return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); };
  const Row = ({ s }: { s: ProjectSelection }) => (
    <div className="flex items-center gap-4 px-4 py-3">
      <Thumb s={s} onView={a.onView} />
      <div className="min-w-0 flex-1"><button type="button" onClick={() => a.onView(s)} className="block max-w-full truncate text-left font-medium hover:text-accent hover:underline">{s.name}</button><div className="truncate text-xs text-muted-foreground">{[s.vendor_name, s.category].filter(Boolean).join(" · ") || "—"}</div></div>
      <span className="hidden text-sm font-semibold sm:block">{money(s.client_price)}</span>
      <RowActions s={s} a={a} />
    </div>
  );
  return (
    <div className="space-y-4">
      {sortedDates.length === 0 && <p className="text-sm text-muted-foreground">No target dates set yet. Set a target install / delivery / decision date on a selection to place it on the calendar.</p>}
      {sortedDates.map((d) => (
        <div key={d} className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-accent" /> {fmt(d)}</div>
          <div className="divide-y divide-border">{groups.get(d)!.map((s) => <Row key={s.id} s={s} />)}</div>
        </div>
      ))}
      {undated.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-dashed border-border">
          <div className="border-b border-border px-4 py-2 text-sm font-semibold text-muted-foreground">No target date</div>
          <div className="divide-y divide-border">{undated.map((s) => <Row key={s.id} s={s} />)}</div>
        </div>
      )}
    </div>
  );
}
