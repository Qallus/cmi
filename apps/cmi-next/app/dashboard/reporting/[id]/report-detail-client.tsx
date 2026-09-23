"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Loader2, FileDown, RefreshCw, Check,
  CircleCheck, Circle, ChevronDown, ChevronRight, ExternalLink, Lock, LockOpen,
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

  return (
    <div className="space-y-5">
      <Link href="/dashboard/reporting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to reporting
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Weekly workload meeting</p>
          <h1 className="font-serif text-2xl">{report.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtDate(report.meeting_date)} · {totals.items} items · {totals.open} of {totals.actions} action items open
            {report.compare_since && <> · changes since {fmtDate(report.compare_since)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/reporting/reports/${report.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline"><FileDown className="h-4 w-4" /> PDF</Button>
          </a>
          {canWrite && report.status === "draft" && (
            <Button variant="outline" onClick={() => void populate()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Pull in current work
            </Button>
          )}
          {canWrite && (
            report.status === "draft"
              ? <Button variant="accent" onClick={() => void setStatus("final")} disabled={busy}><Lock className="h-4 w-4" /> Mark final</Button>
              : <Button variant="outline" onClick={() => void setStatus("draft")} disabled={busy}><LockOpen className="h-4 w-4" /> Reopen</Button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {report.status === "final" && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          This report is final. Reopen it to make changes.
        </p>
      )}

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
          />
        ))}
      </div>

      {!locked && <AddSection reportId={report.id} call={call} reload={reload} />}

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
  );
}

// ─── Section ───────────────────────────────────────────────────────────────

type Call = (url: string, init: RequestInit) => Promise<unknown | null>;

function Section({
  section, owners, locked, call, reload, reportId,
}: {
  section: ReportSection; owners: Owner[]; locked: boolean; call: Call; reload: () => Promise<void>; reportId: string;
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
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium">{section.title}</span>
          <span className="text-xs text-muted-foreground">{section.items.length}</span>
        </button>
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
            <Item key={item.id} item={item} owners={owners} locked={locked} call={call} reload={reload} />
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
  item, owners, locked, call, reload,
}: {
  item: ReportItem; owners: Owner[]; locked: boolean; call: Call; reload: () => Promise<void>;
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
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-sm font-medium">
            {[item.job_number, item.title].filter(Boolean).join("_")}
          </span>
          {item.value_note && <span className="shrink-0 text-xs text-muted-foreground">{item.value_note}</span>}
        </button>
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
