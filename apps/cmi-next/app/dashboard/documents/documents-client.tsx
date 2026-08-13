"use client";

import * as React from "react";
import { FileText, LayoutDashboard, Plus, Search, StickyNote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NotesPanel } from "@/components/notes/notes-panel";
import { WorkspaceTab } from "./workspace-tab";
import type { WorkspaceDocListItem, WorkspaceFolder } from "@/lib/workspace/types";
import type { Document } from "./page";

// Server-hydrated Workspace data for the Workspace tab (Super Admin only; null otherwise).
export type WorkspaceBundle = {
  mine: WorkspaceDocListItem[];
  shared: WorkspaceDocListItem[];
  folders: WorkspaceFolder[];
  templates: { id: string; name: string; description: string; category: string }[];
  hiddenTemplateIds: string[];
  favoriteTemplateIds: string[];
  archived: (WorkspaceDocListItem & { state: "archived" | "trashed" })[];
  workspaces: { id: string; name: string; icon: string | null }[];
  currentWorkspaceId: string;
  notes: { id: string; title: string; body: string; status: string }[];
};

const DOC_STATUSES = ["Draft", "Sent", "Signed", "Completed", "Void"];
const SERVICES_LIST = ["Demo", "Framing", "Electrical", "Plumbing", "HVAC", "Flooring", "Cabinets", "Countertops", "Tile", "Paint", "Roofing", "Permits", "Design", "Project Management"];
const PAYMENT_SCHEDULES = ["50% upfront / 50% on completion", "33% / 33% / 34%", "Monthly draws", "Milestone-based", "Custom"];
const CMI_REPS = ["Brandon Fadden", "Joseph Ballard", "Jeremy Waters"];

const STATUS_TONES: Record<string, "warning" | "info" | "success" | "danger" | "default"> = {
  Draft: "warning",
  Sent: "info",
  Signed: "accent" as "default",
  Completed: "success",
  Void: "danger",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

const BASE_DRAFT: Omit<Document, "id" | "created_at" | "updated_at"> = {
  type: "contract",
  title: "",
  client: "",
  client_email: "",
  client_phone: "",
  project: "",
  location: "",
  date: "",
  start_date: "",
  completion_date: "",
  value: "",
  deposit: "",
  payment_schedule: "50% upfront / 50% on completion",
  payment_terms: "Net 15",
  services: "",
  description: "",
  deliverables: "",
  exclusions: "",
  assumptions: "",
  warranty: "1 year on workmanship",
  change_order: "All change orders must be approved in writing before work begins.",
  dispute: "Mediation in Maricopa County, AZ",
  permits: "CMI",
  roc: "AZ ROC KB-1 #343120",
  cmi_rep: "Brandon Fadden",
  prepared_by: "Jeremy Waters",
  status: "Draft",
  notes: "",
};

type DocTab = "workspace" | "all" | "contract" | "sow" | "notes";

export function DocumentsClient({ initialDocs, workspace = null }: { initialDocs: Document[]; workspace?: WorkspaceBundle | null }) {
  const [docs, setDocs] = React.useState<Document[]>(initialDocs);
  const [tab, setTab] = React.useState<DocTab>(workspace ? "workspace" : "all");
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState<{ mode: "view" | "edit" | "new"; doc?: Document; docType?: "contract" | "sow" } | null>(null);
  const [draft, setDraft] = React.useState<Omit<Document, "id" | "created_at" | "updated_at">>(BASE_DRAFT);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped by the header "Add Note" button to open the note editor in NotesPanel.
  const [notesAddNonce, setNotesAddNonce] = React.useState(0);

  const counts = React.useMemo(() => ({
    all: docs.length,
    contract: docs.filter((d) => d.type === "contract").length,
    sow: docs.filter((d) => d.type === "sow").length,
  }), [docs]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => {
      if (tab !== "all" && d.type !== tab) return false;
      if (q && !d.title.toLowerCase().includes(q) && !(d.client ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, tab, search]);

  function openNew(docType: "contract" | "sow") {
    setDraft({ ...BASE_DRAFT, type: docType, title: docType === "contract" ? "New Contract" : "New Scope of Work" });
    setError(null);
    setModal({ mode: "new", docType });
  }

  function openEdit(d: Document) {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = d;
    setDraft(rest);
    setError(null);
    setModal({ mode: "edit", doc: d });
  }

  function openView(d: Document) { setModal({ mode: "view", doc: d }); }
  function closeModal() { setModal(null); setError(null); }

  async function save() {
    if (!draft.title) { setError("Title is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = modal?.mode === "edit" && modal.doc ? { id: modal.doc.id, ...draft } : draft;
      const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json() as Document & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (modal?.mode === "edit") {
        setDocs((prev) => prev.map((d) => (d.id === json.id ? json : d)));
      } else {
        setDocs((prev) => [json, ...prev]);
      }
      closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  const viewDoc = modal?.doc;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Constructed Matter</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Workspace</h1>
          </div>
          <div className="flex gap-2">
            {tab === "workspace" ? null : tab === "notes" ? (
              <Button size="sm" variant="accent" onClick={() => setNotesAddNonce((n) => n + 1)}><Plus className="h-3.5 w-3.5" /> Add Note</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => openNew("sow")}>+ New SOW</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("notes")}><StickyNote className="h-3.5 w-3.5" /> Add Note</Button>
                <Button size="sm" variant="accent" onClick={() => openNew("contract")}><Plus className="h-3.5 w-3.5" /> New Contract</Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs — scroll horizontally on mobile instead of wrapping */}
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            ...(workspace ? [["workspace", "Workspace"] as [DocTab, string]] : []),
            ["all", "Total"], ["contract", "Contracts"], ["sow", "SOWs"], ["notes", "Notes"],
          ] as [DocTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition", tab === key ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:border-accent/40")}
            >
              {key === "workspace" && <LayoutDashboard className="h-3.5 w-3.5" />}
              {label}
              {(key === "all" || key === "contract" || key === "sow") && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", tab === key ? "bg-accent/20" : "bg-muted")}>{counts[key]}</span>}
            </button>
          ))}
        </div>

        {tab !== "notes" && tab !== "workspace" && (
          <div className="relative mt-3 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
          </div>
        )}
      </div>

      {tab === "workspace" && workspace ? (
        <div className="flex-1 overflow-hidden">
          <WorkspaceTab bundle={workspace} docs={docs} onOpenDoc={openView} onOpenNotes={() => setTab("notes")} />
        </div>
      ) : tab === "notes" ? (
        <div className="flex-1 overflow-hidden">
          <NotesPanel addNonce={notesAddNonce} />
        </div>
      ) : (
      <>
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Document</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Client</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Project</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">Value</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No documents found.</td></tr>}
            {filtered.map((d) => (
              <tr key={d.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => openView(d)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="font-medium">{d.title}</span></div>
                  <div className="ml-6 text-xs text-muted-foreground">{d.id}</div>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{d.client ?? "—"}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{d.project ?? "—"}</td>
                <td className="px-4 py-3"><Badge>{d.type.toUpperCase()}</Badge></td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONES[d.status] ?? "default"}>{d.status}</Badge></td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{d.value ? `$${d.value}` : "—"}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{d.date || formatDate(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* View modal */}
      {modal?.mode === "view" && viewDoc && (
        <DocModal title={viewDoc.title} onClose={closeModal} wide>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{viewDoc.type.toUpperCase()}</Badge>
              <Badge tone={STATUS_TONES[viewDoc.status] ?? "default"}>{viewDoc.status}</Badge>
            </div>
            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              {viewDoc.client && <KV label="Client">{viewDoc.client}</KV>}
              {viewDoc.client_email && <KV label="Email">{viewDoc.client_email}</KV>}
              {viewDoc.project && <KV label="Project">{viewDoc.project}</KV>}
              {viewDoc.location && <KV label="Location">{viewDoc.location}</KV>}
              {viewDoc.value && <KV label="Contract Value">${viewDoc.value}</KV>}
              {viewDoc.deposit && <KV label="Deposit">{viewDoc.deposit}</KV>}
              {viewDoc.start_date && <KV label="Start Date">{viewDoc.start_date}</KV>}
              {viewDoc.completion_date && <KV label="Completion">{viewDoc.completion_date}</KV>}
              {viewDoc.cmi_rep && <KV label="CMI Rep">{viewDoc.cmi_rep}</KV>}
              {viewDoc.roc && <KV label="ROC">{viewDoc.roc}</KV>}
            </div>
            {viewDoc.description && <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap">{viewDoc.description}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => { closeModal(); setTimeout(() => openEdit(viewDoc), 50); }}>Edit</Button>
            </div>
          </div>
        </DocModal>
      )}

      {/* Add / Edit modal */}
      {(modal?.mode === "new" || modal?.mode === "edit") && (
        <DocModal title={modal.mode === "new" ? `New ${modal.docType === "sow" ? "Scope of Work" : "Contract"}` : `Edit: ${modal.doc?.title}`} onClose={closeModal} wide>
          <div className="space-y-5">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

            <DocSection title="Document Setup">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Title" required><input className={iCls} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></F>
                <F label="Status">
                  <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                    {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </F>
                <F label="Date"><Input type="date" value={draft.date ?? ""} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} /></F>
              </div>
            </DocSection>

            <DocSection title="Client Information">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Client Name"><input className={iCls} value={draft.client ?? ""} onChange={(e) => setDraft((d) => ({ ...d, client: e.target.value }))} /></F>
                <F label="Email"><input type="email" className={iCls} value={draft.client_email ?? ""} onChange={(e) => setDraft((d) => ({ ...d, client_email: e.target.value }))} /></F>
                <F label="Phone"><input type="tel" className={iCls} value={draft.client_phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, client_phone: e.target.value }))} /></F>
              </div>
            </DocSection>

            <DocSection title="Project Information">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Project Title"><input className={iCls} value={draft.project ?? ""} onChange={(e) => setDraft((d) => ({ ...d, project: e.target.value }))} /></F>
                <F label="Location"><input className={iCls} value={draft.location ?? ""} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} /></F>
                <F label="Start Date"><Input type="date" value={draft.start_date ?? ""} onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))} /></F>
                <F label="Completion Date"><Input type="date" value={draft.completion_date ?? ""} onChange={(e) => setDraft((d) => ({ ...d, completion_date: e.target.value }))} /></F>
              </div>
              <F label="Scope / Description" className="mt-3">
                <textarea className={cn(iCls, "min-h-[80px] resize-none")} value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </F>
            </DocSection>

            <DocSection title="Financial Terms">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Contract Value ($)"><input className={iCls} value={draft.value ?? ""} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} /></F>
                <F label="Deposit"><input className={iCls} placeholder="e.g. 50% or $5,000" value={draft.deposit ?? ""} onChange={(e) => setDraft((d) => ({ ...d, deposit: e.target.value }))} /></F>
                <F label="Payment Schedule">
                  <Select value={draft.payment_schedule ?? ""} onChange={(e) => setDraft((d) => ({ ...d, payment_schedule: e.target.value }))}>
                    {PAYMENT_SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </F>
                <F label="Payment Terms"><input className={iCls} value={draft.payment_terms ?? ""} onChange={(e) => setDraft((d) => ({ ...d, payment_terms: e.target.value }))} /></F>
              </div>
            </DocSection>

            <DocSection title="Legal & Conditions">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Warranty"><input className={iCls} value={draft.warranty ?? ""} onChange={(e) => setDraft((d) => ({ ...d, warranty: e.target.value }))} /></F>
                <F label="Dispute Resolution"><input className={iCls} value={draft.dispute ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dispute: e.target.value }))} /></F>
                <F label="Permit Responsibility"><input className={iCls} value={draft.permits ?? ""} onChange={(e) => setDraft((d) => ({ ...d, permits: e.target.value }))} /></F>
                <F label="ROC License"><input className={iCls} value={draft.roc ?? ""} onChange={(e) => setDraft((d) => ({ ...d, roc: e.target.value }))} /></F>
              </div>
              <F label="Change Order Policy" className="mt-3">
                <textarea className={cn(iCls, "min-h-[60px] resize-none")} value={draft.change_order ?? ""} onChange={(e) => setDraft((d) => ({ ...d, change_order: e.target.value }))} />
              </F>
            </DocSection>

            <DocSection title="Signatures">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="CMI Representative">
                  <Select value={draft.cmi_rep ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cmi_rep: e.target.value }))}>
                    {CMI_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </F>
                <F label="Prepared By"><input className={iCls} value={draft.prepared_by ?? ""} onChange={(e) => setDraft((d) => ({ ...d, prepared_by: e.target.value }))} /></F>
              </div>
            </DocSection>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Document"}</Button>
            </div>
          </div>
        </DocModal>
      )}
    </div>
  );
}

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

function F({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>{children}</div>;
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-sm">{children}</div></div>;
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div><div className="rounded-lg border border-border p-4">{children}</div></div>;
}

function DocModal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

