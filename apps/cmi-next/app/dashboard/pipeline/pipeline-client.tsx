"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Plus, Search, Table as TableIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ALL_STAGES, ALLOWED_TRANSITIONS, STAGE_META, requiredFieldsForStage,
} from "@/lib/pipeline/stages";
import {
  BUDGET_STATUSES, FOLLOW_UP_FREQUENCIES, LONG_LEAD_REASONS, LOST_REASONS, PROJECT_TYPES,
  type Opportunity, type OpportunityDraft, type PipelineStage,
} from "@/lib/pipeline/types";
import type { PipelineReport } from "@/lib/pipeline/reporting";

// Reason/status option lists that are also selectable at the Active Project /
// Pre-Con transitions.
const AGREEMENT_STATUSES = ["pending", "signed", "verbal_commitment", "design_only", "pre_construction_agreement"];
const CONSTRUCTION_AGREEMENT_STATUSES = ["signed", "committed", "pending_final_signature"];
const BUDGET_RANGES = ["Under $25K", "$25K–$50K", "$50K–$100K", "$100K–$250K", "$250K–$500K", "$500K+"];
const SOURCES = ["Website", "Google", "Referral", "Architect", "Designer", "Realtor", "Past Client", "Social Media", "Event", "Other"];

// Fields that should render as a date picker in the transition panel.
const DATE_FIELDS = new Set<string>([
  "start_date", "actual_completion_date", "warranty_start_date", "warranty_expiration_date",
  "closed_date", "follow_up_date", "budget_due_date", "projected_construction_start_date", "projected_completion_date",
]);

// Fields that render as a specific select in the transition panel.
const SELECT_FIELDS: Record<string, readonly string[]> = {
  construction_agreement_status: CONSTRUCTION_AGREEMENT_STATUSES,
  long_lead_reason: LONG_LEAD_REASONS,
  lost_reason: LOST_REASONS,
  follow_up_frequency: FOLLOW_UP_FREQUENCIES,
  agreement_status: AGREEMENT_STATUSES,
  budget_status: BUDGET_STATUSES,
};

// Extra fields we surface (beyond the strictly required ones) when moving into a
// stage, so staff can capture the alternate-path context in one step.
const EXTRA_FIELDS_FOR_STAGE: Partial<Record<PipelineStage, string[]>> = {
  long_lead: ["follow_up_owner", "follow_up_frequency"],
  not_moving_forward: ["lost_to_builder"],
  active_project: ["contract_value", "projected_completion_date", "superintendent"],
  pre_construction_design: ["agreement_status", "projected_construction_value", "projected_construction_start_date"],
  active_budget: ["budget_status", "budget_owner", "current_budget_total"],
};

function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString()}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// Map a stage-meta tone onto a Badge tone (Badge has no "muted").
function stageTone(stage: PipelineStage): "default" | "accent" | "success" | "warning" | "danger" | "info" {
  const t = STAGE_META[stage].tone;
  return t === "muted" ? "default" : t;
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  return <Badge tone={stageTone(stage)}>{STAGE_META[stage].label}</Badge>;
}

type ModalMode = "add" | "edit" | "view";
type ViewMode = "table" | "kanban";

const EMPTY_DRAFT: OpportunityDraft = {
  opportunity_name: "",
  stage: "opportunity",
  project_type: "",
  project_address: "",
  city: "",
  state: "AZ",
  zip_code: "",
  estimated_budget_range: "",
  estimated_project_value: null,
  probability_percent: null,
  source: "Website",
  referral_source: "",
  assigned_owner: "",
  notes: "",
};

export function PipelineClient({
  initialOpportunities,
  initialReport,
}: {
  initialOpportunities: Opportunity[];
  initialReport: PipelineReport;
}) {
  const [opps, setOpps] = React.useState<Opportunity[]>(initialOpportunities);
  const [report, setReport] = React.useState<PipelineReport>(initialReport);
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<string>("all");
  const [ownerFilter, setOwnerFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [view, setView] = React.useState<ViewMode>("table");
  const [modal, setModal] = React.useState<{ mode: ModalMode; opp?: Opportunity } | null>(null);
  const [draft, setDraft] = React.useState<OpportunityDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // Refresh the list + report from the server after a mutation.
  const refresh = React.useCallback(async () => {
    try {
      const [oppsRes, repRes] = await Promise.all([
        fetch("/api/pipeline"),
        fetch("/api/pipeline/reporting"),
      ]);
      if (oppsRes.ok) setOpps(await oppsRes.json());
      if (repRes.ok) setReport(await repRes.json());
    } catch { /* keep local state */ }
  }, []);

  const owners = React.useMemo(
    () => Array.from(new Set(opps.map((o) => o.assigned_owner).filter(Boolean))) as string[],
    [opps],
  );

  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: opps.length };
    for (const s of ALL_STAGES) counts[s] = opps.filter((o) => o.stage === s).length;
    return counts;
  }, [opps]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return opps.filter((o) => {
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (ownerFilter !== "all" && o.assigned_owner !== ownerFilter) return false;
      if (typeFilter !== "all" && o.project_type !== typeFilter) return false;
      if (q) {
        const hay = `${o.opportunity_name} ${o.job_number ?? ""} ${o.project_address ?? ""} ${o.assigned_owner ?? ""} ${o.project_type ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [opps, search, stageFilter, ownerFilter, typeFilter]);

  function openAdd() { setDraft({ ...EMPTY_DRAFT }); setError(null); setModal({ mode: "add" }); }
  function openView(o: Opportunity) { setError(null); setModal({ mode: "view", opp: o }); }
  function openEdit(o: Opportunity) {
    setDraft({
      opportunity_name: o.opportunity_name,
      stage: o.stage,
      project_type: o.project_type ?? "",
      project_address: o.project_address ?? "",
      city: o.city ?? "",
      state: o.state ?? "AZ",
      zip_code: o.zip_code ?? "",
      estimated_budget_range: o.estimated_budget_range ?? "",
      estimated_project_value: o.estimated_project_value,
      probability_percent: o.probability_percent,
      source: o.source ?? "",
      referral_source: o.referral_source ?? "",
      assigned_owner: o.assigned_owner ?? "",
      notes: o.notes ?? "",
    });
    setError(null);
    setModal({ mode: "edit", opp: o });
  }
  function closeModal() { setModal(null); setError(null); }

  async function save() {
    if (!draft.opportunity_name?.trim()) { setError("Opportunity name is required."); return; }
    setSaving(true); setError(null);
    try {
      if (modal?.mode === "add") {
        const res = await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      } else if (modal?.mode === "edit" && modal.opp) {
        const res = await fetch(`/api/pipeline/${modal.opp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      await refresh();
      closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`); }
      setDeleteConfirm(null);
      if (modal?.opp?.id === id) closeModal();
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed."); }
    finally { setSaving(false); }
  }

  // Called by the detail modal when a transition succeeds — refresh + update the
  // currently-open record so the modal reflects the new stage.
  async function onTransitioned(updated: Opportunity) {
    setModal((m) => (m?.opp ? { ...m, opp: updated } : m));
    await refresh();
  }

  const viewOpp = modal?.opp;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sales</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Sales Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {opps.length} opportunities · Opportunity → Active Budget → Pre-Con → Active Project → Warranty → Closed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <button type="button" onClick={() => setView("table")} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium", view === "table" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
              <button type="button" onClick={() => setView("kanban")} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium", view === "kanban" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
            <Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Opportunity</Button>
          </div>
        </div>

        {/* Reporting strip */}
        <ReportingStrip report={report} />

        {/* Stage tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ key: "all", label: "All" }, ...ALL_STAGES.map((s) => ({ key: s, label: STAGE_META[s].label }))].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStageFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                stageFilter === key ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
              )}
            >
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", stageFilter === key ? "bg-accent/20" : "bg-muted")}>{stageCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search job #, name, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="w-40"><Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select></div>
          <div className="w-40"><Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </Select></div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {view === "table"
          ? <TableView rows={filtered} onOpen={openView} onEdit={openEdit} />
          : <KanbanView rows={filtered} onOpen={openView} />}
      </div>

      {/* View modal */}
      {modal?.mode === "view" && viewOpp && (
        <DetailModal
          opp={viewOpp}
          onClose={closeModal}
          onEdit={() => { closeModal(); setTimeout(() => openEdit(viewOpp), 40); }}
          onDelete={() => setDeleteConfirm(viewOpp.id)}
          onTransitioned={onTransitioned}
        />
      )}

      {/* Add / edit modal */}
      {(modal?.mode === "add" || modal?.mode === "edit") && (
        <Modal title={modal.mode === "add" ? "Add Opportunity" : "Edit Opportunity"} onClose={closeModal} wide>
          <div className="space-y-5">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            {modal.mode === "add" && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                A <strong>job number is created automatically</strong> when this opportunity is saved (format CM-YYYY-####).
                Leads without a real project belong in Contacts / Quotes &amp; Leads, not here.
              </p>
            )}
            <Section title="Opportunity">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Opportunity Name" required className="sm:col-span-2">
                  <input className={inputCls} value={draft.opportunity_name} onChange={(e) => setDraft((d) => ({ ...d, opportunity_name: e.target.value }))} />
                </Field>
                <Field label="Project Type">
                  <Select value={draft.project_type ?? ""} onChange={(e) => setDraft((d) => ({ ...d, project_type: e.target.value }))}>
                    <option value="">— Select —</option>
                    {PROJECT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                  </Select>
                </Field>
                <Field label="Assigned Owner">
                  <input className={inputCls} value={draft.assigned_owner ?? ""} onChange={(e) => setDraft((d) => ({ ...d, assigned_owner: e.target.value }))} />
                </Field>
              </div>
            </Section>
            <Section title="Location">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Project Address" className="sm:col-span-2"><input className={inputCls} value={draft.project_address ?? ""} onChange={(e) => setDraft((d) => ({ ...d, project_address: e.target.value }))} /></Field>
                <Field label="City"><input className={inputCls} value={draft.city ?? ""} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State"><input className={inputCls} value={draft.state ?? ""} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} /></Field>
                  <Field label="Zip"><input className={inputCls} value={draft.zip_code ?? ""} onChange={(e) => setDraft((d) => ({ ...d, zip_code: e.target.value }))} /></Field>
                </div>
              </div>
            </Section>
            <Section title="Value & Forecast">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Budget Range">
                  <Select value={draft.estimated_budget_range ?? ""} onChange={(e) => setDraft((d) => ({ ...d, estimated_budget_range: e.target.value }))}>
                    <option value="">— Select —</option>
                    {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Estimated Value ($)"><input type="number" className={inputCls} value={draft.estimated_project_value ?? ""} onChange={(e) => setDraft((d) => ({ ...d, estimated_project_value: e.target.value ? Number(e.target.value) : null }))} /></Field>
                <Field label="Probability (%)"><input type="number" min={0} max={100} className={inputCls} value={draft.probability_percent ?? ""} onChange={(e) => setDraft((d) => ({ ...d, probability_percent: e.target.value ? Number(e.target.value) : null }))} /></Field>
                <Field label="Source">
                  <Select value={draft.source ?? ""} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}>
                    <option value="">— Select —</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Referral Source" className="sm:col-span-2"><input className={inputCls} value={draft.referral_source ?? ""} onChange={(e) => setDraft((d) => ({ ...d, referral_source: e.target.value }))} /></Field>
              </div>
            </Section>
            <Field label="Scope / Notes"><Textarea value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : modal.mode === "add" ? "Create Opportunity" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="Delete Opportunity" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-muted-foreground">This permanently deletes the opportunity, its stage history, and cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => void confirmDelete(deleteConfirm)}>{saving ? "Deleting…" : "Delete"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reporting strip ───────────────────────────────────────────

function ReportingStrip({ report }: { report: PipelineReport }) {
  const s = report.pipeline_summary;
  const c = report.conversion_rates;
  const tiles = [
    { label: "Est. Pipeline", value: money(s.estimated_pipeline_value) },
    { label: "Forecast (Pre-Con)", value: money(s.forecasted_project_value) },
    { label: "Active Contracts", value: money(s.active_contract_value) },
    { label: "Active Projects", value: String(s.active_project_count) },
    { label: "Warranty", value: String(s.warranty_count) },
    { label: "Long Leads", value: String(s.long_lead_count) },
  ];
  const conv = [
    { label: "Lead → Opp", value: c.lead_to_opportunity_percent },
    { label: "Opp → Budget", value: c.opportunity_to_active_budget_percent },
    { label: "Budget → Pre-Con", value: c.active_budget_to_pre_construction_percent },
    { label: "Pre-Con → Active", value: c.pre_construction_to_active_project_percent },
  ];
  return (
    <div className="mt-4 grid gap-2 lg:grid-cols-[3fr_2fr]">
      <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&>*]:min-w-[30%] [&>*]:shrink-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 [&::-webkit-scrollbar]:hidden">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="mt-0.5 text-sm font-semibold">{t.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {conv.map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="mt-0.5 text-sm font-semibold">{t.value === null ? "—" : `${t.value}%`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table view ────────────────────────────────────────────────

function TableView({ rows, onOpen, onEdit }: { rows: Opportunity[]; onOpen: (o: Opportunity) => void; onEdit: (o: Opportunity) => void }) {
  return (
    <table className="w-full min-w-[760px] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left">
          {["Job #", "Opportunity", "Stage", "Type", "Owner", "Est. Value", "Updated", ""].map((h, i) => (
            <th key={i} className={cn("px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground", i > 3 && i < 7 && "hidden md:table-cell")}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No opportunities found.</td></tr>
        )}
        {rows.map((o) => (
          <tr key={o.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => onOpen(o)}>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.job_number ?? "—"}</td>
            <td className="px-4 py-3">
              <div className="font-medium">{o.opportunity_name}</div>
              {o.project_address && <div className="text-xs text-muted-foreground">{o.project_address}</div>}
            </td>
            <td className="px-4 py-3"><StageBadge stage={o.stage} /></td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{humanize(o.project_type)}</td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{o.assigned_owner ?? "—"}</td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{money(o.estimated_project_value)}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDate(o.updated_at)}</td>
            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => onEdit(o)}>Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Kanban view ───────────────────────────────────────────────

function KanbanView({ rows, onOpen }: { rows: Opportunity[]; onOpen: (o: Opportunity) => void }) {
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {ALL_STAGES.map((stage) => {
        const items = rows.filter((o) => o.stage === stage);
        return (
          <div key={stage} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card/50">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold"><StageBadge stage={stage} /></div>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((o) => (
                <button key={o.id} type="button" onClick={() => onOpen(o)} className="w-full rounded-md border border-border bg-background p-2.5 text-left transition hover:border-accent/50">
                  <div className="font-mono text-[10px] text-muted-foreground">{o.job_number ?? "—"}</div>
                  <div className="mt-0.5 text-sm font-medium leading-tight">{o.opportunity_name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{money(o.estimated_project_value)}</span>
                    <span>{o.assigned_owner ?? ""}</span>
                  </div>
                </button>
              ))}
              {items.length === 0 && <div className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail modal (with guarded stage transitions) ─────────────

function DetailModal({
  opp, onClose, onEdit, onDelete, onTransitioned,
}: {
  opp: Opportunity;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTransitioned: (updated: Opportunity) => void;
}) {
  const [target, setTarget] = React.useState<PipelineStage | null>(null);
  const [tpatch, setTpatch] = React.useState<Record<string, string>>({});
  const [tnote, setTnote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [promoting, setPromoting] = React.useState(false);
  const [promoteMsg, setPromoteMsg] = React.useState<{ ok: boolean; text: string; jobId?: string } | null>(null);

  const allowed = ALLOWED_TRANSITIONS[opp.stage] ?? [];

  // Promote this opportunity into a Job (creates the job record + job number).
  async function promoteToJob() {
    setPromoting(true); setPromoteMsg(null);
    try {
      const res = await fetch("/api/jobs/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opp.id }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error ?? `HTTP ${res.status}`);
      setPromoteMsg({ ok: true, text: `Job ${job.job_number ?? ""} created.`, jobId: job.id });
    } catch (e) {
      setPromoteMsg({ ok: false, text: e instanceof Error ? e.message : "Promotion failed." });
    } finally { setPromoting(false); }
  }

  // Fields to render for the chosen target: the required ones + curated extras.
  const fields = React.useMemo(() => {
    if (!target) return [] as string[];
    const req = requiredFieldsForStage(target) as string[];
    const extra = (EXTRA_FIELDS_FOR_STAGE[target] ?? []).filter((f) => !req.includes(f));
    return [...req, ...extra];
  }, [target]);

  function beginTransition(to: PipelineStage) {
    setErr(null); setTnote(""); setTpatch({}); setTarget(to);
  }

  async function submit() {
    if (!target) return;
    setBusy(true); setErr(null);
    try {
      // Convert numeric-looking money fields to numbers before sending.
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(tpatch)) {
        if (v === "") continue;
        patch[k] = /value|total|_cost/.test(k) ? Number(v) : v;
      }
      const res = await fetch(`/api/pipeline/${opp.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: target, patch, note: tnote || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTarget(null);
      onTransitioned(json as Opportunity);
    } catch (e) { setErr(e instanceof Error ? e.message : "Transition failed."); }
    finally { setBusy(false); }
  }

  const req = target ? (requiredFieldsForStage(target) as string[]) : [];

  return (
    <Modal title={opp.opportunity_name} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={opp.stage} />
          <span className="font-mono text-xs text-muted-foreground">{opp.job_number ?? "—"}</span>
          {opp.project_type && <Badge>{humanize(opp.project_type)}</Badge>}
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {STAGE_META[opp.stage].description}
        </div>

        {/* Stage transition controls */}
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Move to next stage</div>
          {allowed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No further transitions from this stage.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowed.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => beginTransition(to)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    target === to ? "border-accent bg-accent/15 text-accent" : "border-border text-foreground hover:border-accent/50",
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" /> {STAGE_META[to].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transition form for the selected target */}
        {target && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
            <div className="mb-2 text-sm font-medium">Move to {STAGE_META[target].label}</div>
            {err && <div className="mb-2 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <Field key={f} label={humanize(f)} required={req.includes(f)}>
                  {DATE_FIELDS.has(f) ? (
                    <Input type="date" value={tpatch[f] ?? ""} onChange={(e) => setTpatch((p) => ({ ...p, [f]: e.target.value }))} />
                  ) : SELECT_FIELDS[f] ? (
                    <Select value={tpatch[f] ?? ""} onChange={(e) => setTpatch((p) => ({ ...p, [f]: e.target.value }))}>
                      <option value="">— Select —</option>
                      {SELECT_FIELDS[f].map((opt) => <option key={opt} value={opt}>{humanize(opt)}</option>)}
                    </Select>
                  ) : (
                    <input className={inputCls} value={tpatch[f] ?? ""} onChange={(e) => setTpatch((p) => ({ ...p, [f]: e.target.value }))} />
                  )}
                </Field>
              ))}
              <Field label="Note (optional)" className="sm:col-span-2">
                <input className={inputCls} value={tnote} onChange={(e) => setTnote(e.target.value)} placeholder="Why is this moving?" />
              </Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy}>{busy ? "Moving…" : `Move to ${STAGE_META[target].label}`}</Button>
            </div>
          </div>
        )}

        {/* Key details */}
        <div className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          {opp.assigned_owner && <KV label="Owner">{opp.assigned_owner}</KV>}
          {opp.project_address && <KV label="Address">{opp.project_address}</KV>}
          {opp.estimated_project_value != null && <KV label="Est. Value">{money(opp.estimated_project_value)}</KV>}
          {opp.probability_percent != null && <KV label="Probability">{opp.probability_percent}%</KV>}
          {opp.source && <KV label="Source">{opp.source}</KV>}
          {opp.referral_source && <KV label="Referral">{opp.referral_source}</KV>}
          {opp.stage === "long_lead" && <KV label="Follow-up">{formatDate(opp.follow_up_date)} ({humanize(opp.long_lead_reason)})</KV>}
          {opp.stage === "not_moving_forward" && <KV label="Lost Reason">{humanize(opp.lost_reason)}</KV>}
          {opp.stage === "warranty" && <KV label="Warranty Ends">{formatDate(opp.warranty_expiration_date)}</KV>}
          {opp.contract_value != null && <KV label="Contract Value">{money(opp.contract_value)}</KV>}
          <KV label="Created">{formatDate(opp.created_at)}</KV>
        </div>

        {opp.notes && <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">{opp.notes}</div>}

        {/* Promote to Job — creates the downstream project record + job number */}
        {promoteMsg && (
          <div className={cn("rounded-md px-3 py-2 text-sm", promoteMsg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {promoteMsg.text}
            {promoteMsg.ok && promoteMsg.jobId && <> <Link href={`/dashboard/jobs/${promoteMsg.jobId}/summary`} className="font-medium underline">Open Job →</Link></>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button size="sm" variant="accent" onClick={() => void promoteToJob()} disabled={promoting}>{promoting ? "Promoting…" : "Promote to Job"}</Button>
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={onDelete}>Delete</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Shared sub-components ──────────────────────────────────────

const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <div className="rounded-lg border border-border p-4">{children}</div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
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
