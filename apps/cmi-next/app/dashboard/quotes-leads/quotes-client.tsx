"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon,
  MoreHorizontal, Plus, Search, Table as TableIcon, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Quote, QuoteDraft, QuoteStatus } from "@/lib/quotes/types";

const STATUSES: QuoteStatus[] = ["New", "In Review", "Quoted", "Won", "Lost"];
const PROJECT_TYPES = ["Residential", "Commercial", "ADU", "Interior Design", "New Construction", "Project Management", "Renovation", "Other"];
const SERVICES = ["Demo", "Framing", "Electrical", "Plumbing", "HVAC", "Flooring", "Cabinets", "Countertops", "Tile", "Paint", "Roofing", "Landscaping", "Permits", "Design", "Project Management"];
const BUDGET_RANGES = ["Under $25K", "$25K–$50K", "$50K–$100K", "$100K–$250K", "$250K–$500K", "$500K+"];
const TIMELINES = ["ASAP", "1–3 months", "3–6 months", "6–12 months", "12+ months", "Planning stage"];
const SOURCES = ["Website", "Google", "Referral", "Social Media", "Repeat Client", "Event", "Other"];

const STATUS_TONES: Record<QuoteStatus, "warning" | "info" | "accent" | "success" | "danger"> = {
  New: "warning",
  "In Review": "info",
  Quoted: "accent",
  Won: "success",
  Lost: "danger",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

const EMPTY_DRAFT: QuoteDraft = {
  contact_id: null,
  name: "",
  email: "",
  phone: "",
  project_type: "",
  location: "",
  sq_ft: null,
  budget_range: "",
  timeline: "",
  services: [],
  description: "",
  status: "New",
  estimated_value: null,
  source: "Website",
};

type ModalMode = "add" | "edit" | "view";
type ViewMode = "list" | "table" | "calendar" | "kanban";

const VIEWS: { key: ViewMode; label: string; icon: typeof ListIcon }[] = [
  { key: "list", label: "List", icon: ListIcon },
  { key: "table", label: "Table", icon: TableIcon },
  { key: "calendar", label: "Calendar", icon: CalendarIcon },
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
];

export function QuotesClient({ initialQuotes }: { initialQuotes: Quote[] }) {
  const [quotes, setQuotes] = React.useState<Quote[]>(initialQuotes);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [view, setView] = React.useState<ViewMode>("table");
  const [modal, setModal] = React.useState<{ mode: ModalMode; quote?: Quote } | null>(null);
  const [draft, setDraft] = React.useState<QuoteDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [converting, setConverting] = React.useState(false);
  const [convertMsg, setConvertMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const pipelineCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: quotes.length };
    for (const s of STATUSES) counts[s] = quotes.filter((q) => q.status === s).length;
    return counts;
  }, [quotes]);

  const matchesSearch = React.useCallback((item: Quote) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q)
      || (item.email ?? "").toLowerCase().includes(q)
      || (item.location ?? "").toLowerCase().includes(q)
      || (item.project_type ?? "").toLowerCase().includes(q);
  }, [search]);

  // Status tabs + search apply to list/table/calendar.
  const filtered = React.useMemo(
    () => quotes.filter((item) => (statusFilter === "all" || item.status === statusFilter) && matchesSearch(item)),
    [quotes, statusFilter, matchesSearch],
  );

  // Kanban shows every status column, so it ignores the status tab (search still applies).
  const searchFiltered = React.useMemo(() => quotes.filter(matchesSearch), [quotes, matchesSearch]);

  function openAdd() { setDraft({ ...EMPTY_DRAFT }); setError(null); setModal({ mode: "add" }); }
  function openView(q: Quote) { setModal({ mode: "view", quote: q }); setError(null); setConvertMsg(null); }
  function openEdit(q: Quote) {
    setDraft({ contact_id: q.contact_id, name: q.name, email: q.email ?? "", phone: q.phone ?? "", project_type: q.project_type ?? "", location: q.location ?? "", sq_ft: q.sq_ft, budget_range: q.budget_range ?? "", timeline: q.timeline ?? "", services: q.services ?? [], description: q.description ?? "", status: q.status, estimated_value: q.estimated_value, source: q.source ?? "Website" });
    setError(null);
    setModal({ mode: "edit", quote: q });
  }
  function closeModal() { setModal(null); setError(null); }

  function toggleService(s: string) {
    setDraft((d) => ({ ...d, services: (d.services ?? []).includes(s) ? (d.services ?? []).filter((x) => x !== s) : [...(d.services ?? []), s] }));
  }

  async function save() {
    if (!draft.name) { setError("Contact name is required."); return; }
    setSaving(true); setError(null);
    try {
      if (modal?.mode === "add") {
        const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as Quote & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setQuotes((prev) => [json, ...prev]);
      } else if (modal?.mode === "edit" && modal.quote) {
        const res = await fetch(`/api/quotes/${modal.quote.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as Quote & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setQuotes((prev) => prev.map((q) => (q.id === json.id ? json : q)));
      }
      closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      setDeleteConfirm(null);
      if (modal?.quote?.id === id) closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed."); }
    finally { setSaving(false); }
  }

  // Convert a quote (a Lead) into a Sales Pipeline Opportunity. This is the
  // moment a job number is created — see the Sales Pipeline feature.
  async function convertToOpportunity(q: Quote) {
    setConverting(true); setConvertMsg(null);
    try {
      const res = await fetch("/api/pipeline/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "quote", id: q.id, overrides: { opportunity_name: q.name } }),
      });
      const json = await res.json() as { job_number?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setConvertMsg({ ok: true, text: `Created opportunity ${json.job_number ?? ""} — open the Opportunities tab to continue.` });
      // Reflect the quote's new "Won" status locally.
      setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: "Won" } : x)));
    } catch (err) {
      setConvertMsg({ ok: false, text: err instanceof Error ? err.message : "Conversion failed." });
    } finally { setConverting(false); }
  }

  // Update a quote's status (used by the Kanban drag-and-drop). Optimistic with
  // rollback so the board feels instant but stays consistent with the server.
  async function updateStatus(id: string, status: QuoteStatus) {
    const snapshot = quotes;
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Quote;
      setQuotes((prev) => prev.map((q) => (q.id === id ? json : q)));
    } catch {
      setQuotes(snapshot); // rollback on failure
    }
  }

  const viewQuote = modal?.quote;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sales</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Quotes & Leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">{quotes.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  title={v.label}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition",
                    view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <v.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
            <Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Quote</Button>
          </div>
        </div>

        {/* Pipeline status tabs (hidden in Kanban, which shows every column) */}
        <div className={cn("mt-3 flex-wrap gap-1.5", view === "kanban" ? "hidden" : "flex")}>
          {[{ key: "all", label: "All" }, ...STATUSES.map((s) => ({ key: s, label: s }))].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                statusFilter === key
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
              )}
            >
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", statusFilter === key ? "bg-accent/20" : "bg-muted")}>{pipelineCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Body — switches between List / Table / Calendar / Kanban */}
      <div className="flex-1 overflow-auto">
        {view === "table" && <TableView rows={filtered} onOpen={openView} onEdit={openEdit} />}
        {view === "list" && <ListView rows={filtered} onOpen={openView} onEdit={openEdit} />}
        {view === "calendar" && <CalendarView rows={filtered} onOpen={openView} />}
        {view === "kanban" && <KanbanView rows={searchFiltered} onOpen={openView} onStatusChange={updateStatus} />}
      </div>

      {/* View Modal */}
      {modal?.mode === "view" && viewQuote && (
        <Modal title={viewQuote.name} onClose={closeModal} wide>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONES[viewQuote.status]}>{viewQuote.status}</Badge>
              {viewQuote.project_type && <Badge>{viewQuote.project_type}</Badge>}
              {viewQuote.source && <Badge>{viewQuote.source}</Badge>}
            </div>
            <div className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
              {viewQuote.email && <KV label="Email">{viewQuote.email}</KV>}
              {viewQuote.phone && <KV label="Phone">{viewQuote.phone}</KV>}
              {viewQuote.location && <KV label="Location">{viewQuote.location}</KV>}
              {viewQuote.budget_range && <KV label="Budget">{viewQuote.budget_range}</KV>}
              {viewQuote.timeline && <KV label="Timeline">{viewQuote.timeline}</KV>}
              {viewQuote.sq_ft && <KV label="Sq Ft">{viewQuote.sq_ft.toLocaleString()} sq ft</KV>}
              {viewQuote.estimated_value && <KV label="Est. Value">${viewQuote.estimated_value.toLocaleString()}</KV>}
              <KV label="Received">{formatDate(viewQuote.created_at)}</KV>
            </div>
            {(viewQuote.services ?? []).length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Services Requested</div>
                <div className="flex flex-wrap gap-1.5">{(viewQuote.services ?? []).map((s) => <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs">{s}</span>)}</div>
              </div>
            )}
            {viewQuote.description && <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">{viewQuote.description}</div>}
            {convertMsg && (
              <div className={cn("rounded-md px-3 py-2 text-sm", convertMsg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                {convertMsg.text}
                {convertMsg.ok && <> <Link href="/dashboard/sales?tab=opportunities" className="font-medium underline">Go to Opportunities →</Link></>}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button size="sm" variant="accent" onClick={() => void convertToOpportunity(viewQuote)} disabled={converting}>
                {converting ? "Converting…" : "Convert to Opportunity"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { closeModal(); setTimeout(() => openEdit(viewQuote), 50); }}>Edit</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteConfirm(viewQuote.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Modal */}
      {(modal?.mode === "add" || modal?.mode === "edit") && (
        <Modal title={modal.mode === "add" ? "Add Quote / Lead" : "Edit Quote"} onClose={closeModal} wide>
          <div className="space-y-5">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

            <Section title="Contact Information">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full Name" required><input className={inputCls} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
                <Field label="Email"><input type="email" className={inputCls} value={draft.email ?? ""} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></Field>
                <Field label="Phone"><input type="tel" className={inputCls} value={draft.phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></Field>
                <Field label="Source">
                  <Select value={draft.source ?? "Website"} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
              </div>
            </Section>

            <Section title="Project Details">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Project Type">
                  <Select value={draft.project_type ?? ""} onChange={(e) => setDraft((d) => ({ ...d, project_type: e.target.value }))}>
                    <option value="">— Select —</option>
                    {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Location"><input className={inputCls} value={draft.location ?? ""} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} /></Field>
                <Field label="Square Footage"><input type="number" className={inputCls} value={draft.sq_ft ?? ""} onChange={(e) => setDraft((d) => ({ ...d, sq_ft: e.target.value ? Number(e.target.value) : null }))} /></Field>
                <Field label="Budget Range">
                  <Select value={draft.budget_range ?? ""} onChange={(e) => setDraft((d) => ({ ...d, budget_range: e.target.value }))}>
                    <option value="">— Select —</option>
                    {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Timeline">
                  <Select value={draft.timeline ?? ""} onChange={(e) => setDraft((d) => ({ ...d, timeline: e.target.value }))}>
                    <option value="">— Select —</option>
                    {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as QuoteStatus }))}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Services Requested" className="mt-3">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SERVICES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", (draft.services ?? []).includes(s) ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:border-accent/40")}
                    >{s}</button>
                  ))}
                </div>
              </Field>
            </Section>

            <Field label="Description / Notes">
              <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : modal.mode === "add" ? "Add Quote" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="Delete Quote" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-muted-foreground">This will permanently delete the quote and cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => void confirmDelete(deleteConfirm)}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Views ───────────────────────────────────────────────────

function TableView({ rows, onOpen, onEdit }: { rows: Quote[]; onOpen: (q: Quote) => void; onEdit: (q: Quote) => void }) {
  return (
    <table className="w-full min-w-[600px] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left">
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Contact</th>
          <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Project Type</th>
          <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">Location</th>
          <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Budget</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
          <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Received</th>
          <th className="w-10 px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No quotes found.</td></tr>
        )}
        {rows.map((q) => (
          <tr key={q.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => onOpen(q)}>
            <td className="px-4 py-3">
              <div className="font-medium">{q.name}</div>
              {q.email && <div className="text-xs text-muted-foreground">{q.email}</div>}
            </td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{q.project_type ?? "—"}</td>
            <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{q.location ?? "—"}</td>
            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{q.budget_range ?? "—"}</td>
            <td className="px-4 py-3"><Badge tone={STATUS_TONES[q.status]}>{q.status}</Badge></td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(q.created_at)}</td>
            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit(q); }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListView({ rows, onOpen, onEdit }: { rows: Quote[]; onOpen: (q: Quote) => void; onEdit: (q: Quote) => void }) {
  if (rows.length === 0) return <div className="px-4 py-12 text-center text-sm text-muted-foreground">No quotes found.</div>;
  return (
    <div className="divide-y divide-border">
      {rows.map((q) => (
        <button key={q.id} type="button" onClick={() => onOpen(q)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/30 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{q.name}</span>
              <Badge tone={STATUS_TONES[q.status]}>{q.status}</Badge>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {[q.project_type, q.location, q.budget_range].filter(Boolean).join(" · ") || q.email || "—"}
            </div>
          </div>
          <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatDate(q.created_at)}</div>
          <span onClick={(e) => { e.stopPropagation(); onEdit(q); }} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </button>
      ))}
    </div>
  );
}

function CalendarView({ rows, onOpen }: { rows: Quote[]; onOpen: (q: Quote) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  // Bucket quotes by their received (created_at) day.
  const byDay = React.useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of rows) {
      const key = new Date(q.created_at).toISOString().slice(0, 10);
      (map.get(key) ?? map.set(key, []).get(key)!).push(q);
    }
    return map;
  }, [rows]);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const today = new Date().toISOString().slice(0, 10);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-center text-[11px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-card py-2">{d}</div>)}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const items = byDay.get(key) ?? [];
          const muted = day.getMonth() !== cursor.getMonth();
          return (
            <div key={key} className={cn("min-h-[92px] bg-background p-1.5 text-left", muted && "opacity-40")}>
              <div className={cn("mb-1 text-[11px]", key === today ? "font-bold text-accent" : "text-muted-foreground")}>{day.getDate()}</div>
              <div className="space-y-1">
                {items.slice(0, 3).map((q) => (
                  <button key={q.id} type="button" onClick={() => onOpen(q)} className="block w-full truncate rounded bg-accent/10 px-1.5 py-0.5 text-left text-[11px] text-foreground hover:bg-accent/20">
                    {q.name}
                  </button>
                ))}
                {items.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanView({ rows, onOpen, onStatusChange }: { rows: Quote[]; onOpen: (q: Quote) => void; onStatusChange: (id: string, status: QuoteStatus) => void }) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStatus, setOverStatus] = React.useState<QuoteStatus | null>(null);

  function onDrop(status: QuoteStatus) {
    if (dragId) {
      const q = rows.find((x) => x.id === dragId);
      if (q && q.status !== status) onStatusChange(dragId, status);
    }
    setDragId(null); setOverStatus(null);
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {STATUSES.map((status) => {
        const items = rows.filter((q) => q.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOverStatus(status); }}
            onDragLeave={() => setOverStatus((s) => (s === status ? null : s))}
            onDrop={() => onDrop(status)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-card/50 transition",
              overStatus === status ? "border-accent ring-2 ring-accent/30" : "border-border",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <Badge tone={STATUS_TONES[status]}>{status}</Badge>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((q) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => setDragId(q.id)}
                  onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                  onClick={() => onOpen(q)}
                  className={cn(
                    "cursor-grab rounded-md border border-border bg-background p-2.5 transition hover:border-accent/50 active:cursor-grabbing",
                    dragId === q.id && "opacity-50",
                  )}
                >
                  <div className="text-sm font-medium leading-tight">{q.name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{q.project_type ?? "—"}</span>
                    <span className="shrink-0">{q.budget_range ?? ""}</span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="px-2 py-6 text-center text-xs text-muted-foreground">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

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

