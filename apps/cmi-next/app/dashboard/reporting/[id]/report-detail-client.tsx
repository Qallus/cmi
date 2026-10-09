"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Loader2, FileDown, RefreshCw, Check,
  CircleCheck, Circle, ChevronDown, ChevronRight, ExternalLink, Lock, LockOpen,
  List, Table2, Columns3, X, CalendarDays, ArrowRightLeft, ListPlus, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ReportActionItem, ReportDetail, ReportItem, ReportSection } from "@/lib/reporting/types";

type Owner = { id: string; name: string };

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const RECORD_HREF: Record<string, (id: string) => string> = {
  deal: (id) => `/dashboard/pipeline/${id}`,
  job: (id) => `/dashboard/jobs/${id}/summary`,
  projection: (id) => `/dashboard/projections/${id}`,
};

export function ReportDetailClient({
  initialReport, owners, canWrite,
}: {
  initialReport: ReportDetail;
  owners: Owner[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [report, setReport] = React.useState(initialReport);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const res = await fetch(`/api/reporting/reports/${report.id}`);
    if (res.ok) setReport(await res.json());
  }, [report.id]);

  async function call(url: string, init: RequestInit): Promise<unknown | null> {
    setError(null);
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError((json as { error?: string }).error ?? "That didn't save."); return null; }
    return json;
  }

  async function populate() {
    setBusy(true);
    const result = await call(`/api/reporting/reports/${report.id}/populate`, { method: "POST" });
    if (result) setReport((result as { report: ReportDetail }).report);
    setBusy(false);
  }

  async function setStatus(status: "draft" | "final") {
    setBusy(true);
    const saved = await call(`/api/reporting/reports/${report.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (saved) setReport((r) => ({ ...r, ...(saved as ReportDetail) }));
    setBusy(false);
  }

  const totals = React.useMemo(() => {
    const items = report.sections.flatMap((s) => s.items);
    const actions = items.flatMap((i) => i.action_items);
    return { items: items.length, open: actions.filter((a) => !a.completed_at).length, actions: actions.length };
  }, [report]);

  const locked = report.status === "final" || !canWrite;

  // ── View + selection ──
  const [view, setView] = React.useState<ReportView>("list");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allIds = React.useMemo(() => report.sections.flatMap((s) => s.items.map((i) => i.id)), [report]);
  // Items removed by a reload drop out of the selection on their own.
  const selectedIds = allIds.filter((id) => selected.has(id));
  const allChecked = allIds.length > 0 && selectedIds.length === allIds.length;
  const selection: Selection = {
    enabled: !locked,
    has: (id) => selected.has(id),
    toggle: (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }),
    setMany: (ids, on) => setSelected((prev) => { const next = new Set(prev); for (const id of ids) { if (on) next.add(id); else next.delete(id); } return next; }),
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <Link href="/dashboard/reporting" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to reporting
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Weekly workload meeting</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{report.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtDate(report.meeting_date)} · {totals.items} items · {totals.open} of {totals.actions} action items open
              {report.compare_since && <> · changes since {fmtDate(report.compare_since)}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/reporting/reports/${report.id}/pdf`} target="_blank" rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
            {canWrite && report.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => void populate()} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Pull in current work
              </Button>
            )}
            {canWrite && (
              report.status === "draft"
                ? <Button size="sm" variant="accent" onClick={() => void setStatus("final")} disabled={busy}><Lock className="h-3.5 w-3.5" /> Mark final</Button>
                : <Button size="sm" variant="outline" onClick={() => void setStatus("draft")} disabled={busy}><LockOpen className="h-3.5 w-3.5" /> Reopen</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4 md:p-6">
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {report.status === "final" && (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            This report is final. Reopen it to make changes.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!locked && allIds.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = selectedIds.length > 0 && !allChecked; }}
                  onChange={() => selection.setMany(allIds, !allChecked)} aria-label="Select all items" />
                {selectedIds.length ? `${selectedIds.length} of ${allIds.length} selected` : "Select all"}
              </label>
            )}
          </div>
          <div role="tablist" className="flex overflow-hidden rounded-md border border-border text-xs">
            {VIEWS.map((v) => (
              <button key={v.key} role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)} title={v.label}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 transition-colors", view === v.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                <v.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {view === "list" && (
          <div className="space-y-4">
            {report.sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                owners={owners}
                locked={locked}
                call={call}
                reload={reload}
                reportId={report.id}
                selection={selection}
              />
            ))}
          </div>
        )}
        {view === "table" && <TableView sections={report.sections} selection={selection} />}
        {view === "board" && <BoardView sections={report.sections} selection={selection} />}

        {!locked && view === "list" && <AddSection reportId={report.id} call={call} reload={reload} />}

        {canWrite && (
          <div className="pt-4">
            <button
              onClick={async () => {
                if (!window.confirm("Delete this report? The projects and leads themselves aren't touched.")) return;
                await fetch(`/api/reporting/reports/${report.id}`, { method: "DELETE" });
                router.push("/dashboard/reporting");
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Delete this report
            </button>
          </div>
        )}
      </div>

      {!locked && (
        <BulkBar
          ids={selectedIds}
          sections={report.sections}
          owners={owners}
          call={call}
          onClear={() => setSelected(new Set())}
          onDone={async () => { setSelected(new Set()); await reload(); }}
        />
      )}
    </div>
  );
}

// ─── Views & selection ─────────────────────────────────────────────────────

type ReportView = "list" | "table" | "board";
const VIEWS: { key: ReportView; label: string; icon: typeof List }[] = [
  { key: "list", label: "List", icon: List },
  { key: "table", label: "Table", icon: Table2 },
  { key: "board", label: "Board", icon: Columns3 },
];

type Selection = {
  enabled: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
};

const itemLabel = (item: ReportItem) => [item.job_number, item.title].filter(Boolean).join("_");

function RowCheck({ id, selection }: { id: string; selection: Selection }) {
  if (!selection.enabled) return null;
  return (
    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent)]" checked={selection.has(id)}
      onChange={() => selection.toggle(id)} onClick={(e) => e.stopPropagation()} aria-label="Select item" />
  );
}

function GroupCheck({ ids, selection, label }: { ids: string[]; selection: Selection; label: string }) {
  if (!selection.enabled || ids.length === 0) return null;
  const on = ids.filter((id) => selection.has(id)).length;
  return (
    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent)]" checked={on === ids.length}
      ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }}
      onChange={() => selection.setMany(ids, on !== ids.length)} aria-label={label} />
  );
}

function TableView({ sections, selection }: { sections: ReportSection[]; selection: Selection }) {
  const rows = sections.flatMap((s) => s.items.map((item) => ({ item, section: s })));
  if (!rows.length) return <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">No items in this report yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b border-border text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2.5"><GroupCheck ids={rows.map((r) => r.item.id)} selection={selection} label="Select all items" /></th>
            <th className="px-3 py-2.5 font-medium">Project / item</th>
            <th className="px-3 py-2.5 font-medium">Section</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Current completion</th>
            <th className="px-3 py-2.5 font-medium">Open actions</th>
            <th className="px-3 py-2.5 font-medium">Latest update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ item, section }) => {
            const open = item.action_items.filter((a) => !a.completed_at).length;
            return (
              <tr key={item.id} className={cn("hover:bg-muted/40", selection.has(item.id) && "bg-accent/5")}>
                <td className="px-3 py-2.5"><RowCheck id={item.id} selection={selection} /></td>
                <td className="px-3 py-2.5 font-medium">{itemLabel(item)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{section.title}</td>
                <td className="px-3 py-2.5">{item.status_text ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{item.status_text}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(item.current_completion) || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{open || "—"}</td>
                <td className="max-w-[320px] px-3 py-2.5 text-xs text-muted-foreground"><span className="line-clamp-2">{item.latest_update || "—"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BoardView({ sections, selection }: { sections: ReportSection[]; selection: Selection }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {sections.map((section) => (
        <div key={section.id} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <GroupCheck ids={section.items.map((i) => i.id)} selection={selection} label={`Select all in ${section.title}`} />
            <span className="flex-1 truncate text-sm font-medium">{section.title}</span>
            <span className="text-xs text-muted-foreground">{section.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {section.items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">Nothing here.</p>}
            {section.items.map((item) => {
              const open = item.action_items.filter((a) => !a.completed_at).length;
              return (
                <div key={item.id} className={cn("rounded-md border border-border bg-card p-3 text-sm", selection.has(item.id) && "border-accent/50 bg-accent/5")}>
                  <div className="flex items-start gap-2">
                    <RowCheck id={item.id} selection={selection} />
                    <span className="min-w-0 flex-1 font-medium leading-snug">{itemLabel(item)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.status_text && <span className="rounded-full bg-muted px-2 py-0.5">{item.status_text}</span>}
                    {open > 0 && <span>{open} open</span>}
                    {item.current_completion && <span>Due {fmtDate(item.current_completion)}</span>}
                  </div>
                  {item.latest_update && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.latest_update}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick actions for selected items ──────────────────────────────────────

type BulkPanel = "status" | "date" | "move" | "action" | null;

function BulkBar({
  ids, sections, owners, call, onClear, onDone,
}: {
  ids: string[]; sections: ReportSection[]; owners: Owner[]; call: Call;
  onClear: () => void; onDone: () => Promise<void>;
}) {
  const [panel, setPanel] = React.useState<BulkPanel>(null);
  const [text, setText] = React.useState("");
  const [date, setDate] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  if (!ids.length && !toast) return null;

  const n = ids.length;
  const plural = `${n} item${n === 1 ? "" : "s"}`;

  // Each item is its own request, so one failure doesn't block the rest.
  async function run(label: string, each: (id: string, index: number) => Promise<unknown | null>) {
    setWorking(true);
    const results = await Promise.all(ids.map((id, i) => each(id, i)));
    const ok = results.filter((r) => r !== null).length;
    setWorking(false);
    setPanel(null); setText(""); setDate(""); setOwner("");
    setToast(ok === n ? `${label}: ${plural}.` : `${label}: ${ok} of ${n} saved.`);
    window.setTimeout(() => setToast(null), 4000);
    await onDone();
  }

  const patch = (body: Record<string, unknown>) => (id: string) =>
    call(`/api/reporting/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const btn = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted";
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-2 shadow-xl">
        {toast && !n ? (
          <p className="flex items-center gap-1.5 px-2 py-1.5 text-sm"><Check className="h-4 w-4 text-[#2e7d5b]" /> {toast}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <span className="px-2 text-sm font-medium">{n} selected</span>
              <span className="mx-1 h-5 w-px bg-border" />
              <button className={cn(btn, panel === "status" && "bg-muted")} onClick={() => setPanel(panel === "status" ? null : "status")}><Tag className="h-3.5 w-3.5" /> Status</button>
              <button className={cn(btn, panel === "date" && "bg-muted")} onClick={() => setPanel(panel === "date" ? null : "date")}><CalendarDays className="h-3.5 w-3.5" /> Completion date</button>
              <button className={cn(btn, panel === "move" && "bg-muted")} onClick={() => setPanel(panel === "move" ? null : "move")}><ArrowRightLeft className="h-3.5 w-3.5" /> Move</button>
              <button className={cn(btn, panel === "action" && "bg-muted")} onClick={() => setPanel(panel === "action" ? null : "action")}><ListPlus className="h-3.5 w-3.5" /> Action item</button>
              <button className={cn(btn, "text-destructive hover:bg-destructive/10")} disabled={working}
                onClick={() => {
                  if (!window.confirm(`Remove ${plural} from this report? The projects and leads themselves aren't touched.`)) return;
                  void run("Removed", (id) => call(`/api/reporting/items/${id}`, { method: "DELETE" }));
                }}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
              <span className="flex-1" />
              {working && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button className="rounded p-1.5 text-muted-foreground hover:bg-muted" onClick={onClear} aria-label="Clear selection"><X className="h-4 w-4" /></button>
            </div>

            {panel === "status" && (
              <form className="mt-2 flex gap-2 border-t border-border px-1 pt-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void run("Status set", patch({ status_text: text.trim() })); }}>
                <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. In Progress, Contracted, Signed LOI" />
                <Button size="sm" variant="accent" type="submit" disabled={working || !text.trim()}>Apply to {plural}</Button>
              </form>
            )}
            {panel === "date" && (
              <form className="mt-2 flex gap-2 border-t border-border px-1 pt-2" onSubmit={(e) => { e.preventDefault(); if (date) void run("Completion date set", patch({ current_completion: date })); }}>
                <Input type="date" autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
                <Button size="sm" variant="accent" type="submit" disabled={working || !date}>Apply to {plural}</Button>
              </form>
            )}
            {panel === "move" && (
              <form className="mt-2 flex gap-2 border-t border-border px-1 pt-2" onSubmit={(e) => {
                e.preventDefault();
                const target = sections.find((s) => s.id === sectionId);
                if (!target) return;
                const base = target.items.length;
                void run(`Moved to ${target.title}`, (id, i) => patch({ section_id: target.id, sort_order: base + i })(id));
              }}>
                <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">Choose a section…</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </Select>
                <Button size="sm" variant="accent" type="submit" disabled={working || !sectionId}>Move {plural}</Button>
              </form>
            )}
            {panel === "action" && (
              <form className="mt-2 grid gap-2 border-t border-border px-1 pt-2 sm:grid-cols-[1fr_180px_150px_auto]" onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                const who = owners.find((o) => o.id === owner);
                void run("Action item added", (id) => call(`/api/reporting/items/${id}/actions`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ body: text.trim(), owner_staff_id: who?.id ?? null, owner_label: who?.name ?? null, due_date: date || null }),
                }));
              }}>
                <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to happen next" />
                <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">No owner</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Button size="sm" variant="accent" type="submit" disabled={working || !text.trim()}>Add to {plural}</Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────

type Call = (url: string, init: RequestInit) => Promise<unknown | null>;

function Section({
  section, owners, locked, call, reload, reportId, selection,
}: {
  section: ReportSection; owners: Owner[]; locked: boolean; call: Call; reload: () => Promise<void>; reportId: string; selection: Selection;
}) {
  const [open, setOpen] = React.useState(true);
  const [adding, setAdding] = React.useState(false);

  async function addItem(title: string) {
    if (!title.trim()) return;
    await call(`/api/reporting/reports/${reportId}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: section.id, title }),
    });
    setAdding(false);
    await reload();
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <GroupCheck ids={section.items.map((i) => i.id)} selection={selection} label={`Select all in ${section.title}`} />
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium">{section.title}</span>
            <span className="text-xs text-muted-foreground">{section.items.length}</span>
          </button>
        </div>
        {!locked && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Item</Button>
            <button
              aria-label="Remove section"
              title="Remove section"
              onClick={async () => {
                if (!window.confirm(`Remove "${section.title}" and its ${section.items.length} items from this report?`)) return;
                await call(`/api/reporting/sections/${section.id}`, { method: "DELETE" });
                await reload();
              }}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {open && (
        <div className="divide-y divide-border">
          {section.items.length === 0 && !adding && (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nothing in this section.</p>
          )}
          {section.items.map((item) => (
            <Item key={item.id} item={item} owners={owners} locked={locked} call={call} reload={reload} selection={selection} />
          ))}
          {adding && <QuickAdd placeholder="Project or lead name" onCancel={() => setAdding(false)} onSave={addItem} />}
        </div>
      )}
    </section>
  );
}

function AddSection({ reportId, call, reload }: { reportId: string; call: Call; reload: () => Promise<void> }) {
  const [adding, setAdding] = React.useState(false);
  if (!adding) {
    return (
      <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add a section</Button>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <QuickAdd
        placeholder="Section title"
        onCancel={() => setAdding(false)}
        onSave={async (title) => {
          await call(`/api/reporting/reports/${reportId}/sections`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
          });
          setAdding(false);
          await reload();
        }}
      />
    </div>
  );
}

// ─── Item ──────────────────────────────────────────────────────────────────

function Item({
  item, owners, locked, call, reload, selection,
}: {
  item: ReportItem; owners: Owner[]; locked: boolean; call: Call; reload: () => Promise<void>; selection: Selection;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [addingAction, setAddingAction] = React.useState(false);

  const href = item.record_type && item.record_id ? RECORD_HREF[item.record_type]?.(item.record_id) : null;
  const openActions = item.action_items.filter((a) => !a.completed_at).length;

  const save = (patch: Partial<ReportItem>) =>
    call(`/api/reporting/items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    }).then(() => reload());

  return (
    <div className={cn("px-4 py-3", selection.has(item.id) && "bg-accent/5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RowCheck id={item.id} selection={selection} />
          <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="truncate text-sm font-medium">{itemLabel(item)}</span>
            {item.value_note && <span className="shrink-0 text-xs text-muted-foreground">{item.value_note}</span>}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {item.status_text && <span className="rounded-full bg-muted px-2 py-0.5">{item.status_text}</span>}
          {openActions > 0 && <span>{openActions} open</span>}
          {href && (
            <Link href={href} title="Open the record" className="rounded p-1 hover:bg-muted hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {!locked && (
            <button
              aria-label="Remove item"
              title="Remove from this report"
              onClick={async () => {
                if (!window.confirm(`Remove "${item.title}" from this report?`)) return;
                await call(`/api/reporting/items/${item.id}`, { method: "DELETE" });
                await reload();
              }}
              className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!expanded && (item.latest_update || item.action_items.length > 0) && (
        <div className="mt-1 pl-5 text-xs text-muted-foreground">
          {item.latest_update && <p className="line-clamp-1">{item.latest_update}</p>}
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-3 pl-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <EditField label="Status" value={item.status_text} locked={locked} onSave={(v) => save({ status_text: v })} />
            <EditField label="Financial" value={item.financial_note} locked={locked} onSave={(v) => save({ financial_note: v })} />
            <EditField label="Original completion" type="date" value={item.original_completion} locked={locked} onSave={(v) => save({ original_completion: v })} />
            <EditField label="Current completion" type="date" value={item.current_completion} locked={locked} onSave={(v) => save({ current_completion: v })} />
          </div>

          <EditArea
            label="Latest update — what happened"
            value={item.latest_update}
            locked={locked}
            hint={item.record_id ? "Also posted to this record's timeline." : undefined}
            onSave={(v) => save({ latest_update: v })}
          />

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Action items — what happens next
            </p>
            <ul className="space-y-1.5">
              {item.action_items.map((action) => (
                <Action key={action.id} action={action} owners={owners} locked={locked} call={call} reload={reload} />
              ))}
            </ul>
            {!locked && (
              addingAction ? (
                <QuickAdd
                  placeholder="e.g. Follow up with client Friday"
                  onCancel={() => setAddingAction(false)}
                  onSave={async (body) => {
                    await call(`/api/reporting/items/${item.id}/actions`, {
                      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
                    });
                    setAddingAction(false);
                    await reload();
                  }}
                />
              ) : (
                <button onClick={() => setAddingAction(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  <Plus className="h-3 w-3" /> Add action item
                </button>
              )
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <EditArea label="Procurement" value={item.procurement_note} locked={locked} onSave={(v) => save({ procurement_note: v })} />
            <EditArea label="Notes" value={item.notes} locked={locked} onSave={(v) => save({ notes: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function Action({
  action, owners, locked, call, reload,
}: {
  action: ReportActionItem; owners: Owner[]; locked: boolean; call: Call; reload: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(action.body);

  const save = (patch: Partial<ReportActionItem>) =>
    call(`/api/reporting/actions/${action.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    }).then(() => reload());

  const done = !!action.completed_at;
  const overdue = !done && !!action.due_date && action.due_date < new Date().toISOString().slice(0, 10);

  return (
    <li className="flex items-start gap-2">
      <button
        disabled={locked}
        title={done ? "Mark open" : "Mark done"}
        onClick={() => void save({ completed_at: done ? null : new Date().toISOString() })}
        className="mt-0.5 shrink-0 text-accent disabled:opacity-50"
      >
        {done ? <CircleCheck className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-2">
            <Input value={body} onChange={(e) => setBody(e.target.value)} />
            <Button size="sm" variant="accent" onClick={async () => { await save({ body }); setEditing(false); }}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <button
            disabled={locked}
            onClick={() => setEditing(true)}
            className={cn("block w-full whitespace-pre-wrap text-left text-sm", done && "text-muted-foreground line-through")}
          >
            {action.body}
            {action.carried_from_id && <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">carried over</span>}
          </button>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Select
            className="h-7 w-auto text-xs"
            disabled={locked}
            value={action.owner_staff_id ?? ""}
            onChange={(e) => void save({ owner_staff_id: e.target.value || null })}
          >
            <option value="">{action.owner_label ? `${action.owner_label} — pick a person` : "Unassigned"}</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Input
            type="date"
            className="h-7 w-auto text-xs"
            disabled={locked}
            value={action.due_date ?? ""}
            onChange={(e) => void save({ due_date: e.target.value || null })}
          />
          {overdue && <span className="text-destructive">overdue</span>}
          {!locked && (
            <button
              aria-label="Delete action item"
              onClick={async () => { await call(`/api/reporting/actions/${action.id}`, { method: "DELETE" }); await reload(); }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Inline editors ────────────────────────────────────────────────────────

type EditProps = { label: string; value: string | null; locked: boolean; type?: string; hint?: string; onSave: (v: string | null) => void };

// Keyed on the saved value so a reload re-seeds the draft by remounting,
// rather than an effect that writes state on every render pass.
function EditField(props: EditProps) {
  return <EditFieldInner key={props.value ?? ""} {...props} />;
}

function EditFieldInner({ label, value, locked, type, onSave }: EditProps) {
  const [draft, setDraft] = React.useState(value ?? "");

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        type={type}
        disabled={locked}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (value ?? "")) onSave(draft || null); }}
      />
    </label>
  );
}

function EditArea(props: EditProps) {
  return <EditAreaInner key={props.value ?? ""} {...props} />;
}

function EditAreaInner({ label, value, locked, hint, onSave }: EditProps) {
  const [draft, setDraft] = React.useState(value ?? "");

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Textarea
        disabled={locked}
        value={draft}
        className="min-h-[60px]"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (value ?? "")) onSave(draft || null); }}
      />
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function QuickAdd({ placeholder, onSave, onCancel }: { placeholder: string; onSave: (value: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!value.trim()) { onCancel(); return; }
    setBusy(true);
    await onSave(value.trim());
    setBusy(false);
    setValue("");
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); if (e.key === "Escape") onCancel(); }}
      />
      <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
