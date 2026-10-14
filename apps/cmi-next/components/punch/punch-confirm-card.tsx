"use client";

// The card Bolt shows after "create a punch list for …": the record, the
// list, and every item — editable. Rename items, add more, assign each one
// (or all at once), remove anything misheard, then Save. Nothing is written
// until Save. Used by the Agent page and the Bolt pop-up.
import * as React from "react";
import Link from "next/link";
import { Check, ClipboardCheck, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingAction } from "@/lib/agent/types";
import { PARENT_LABEL, type PunchItemDraft } from "@/lib/punch/types";
import { usePunchMeta } from "./shared";

function hrefFor(type: string, id: string) {
  if (type === "job") return `/dashboard/jobs/${id}/punch-list`;
  if (type === "precon") return `/dashboard/sales/${id}?tab=punch`;
  return `/dashboard/pipeline/${id}`;
}

type Row = PunchItemDraft & { key: number };
let seq = 1;

export function PunchConfirmCard({ action }: { action: PendingAction }) {
  const p = action.punch;
  const meta = usePunchMeta();
  const [title, setTitle] = React.useState(p?.list_title ?? "Punch List");
  const [rows, setRows] = React.useState<Row[]>(() => (p?.items ?? []).map((i) => ({ ...i, key: seq++ })));
  const [draft, setDraft] = React.useState("");
  const [state, setState] = React.useState<"idle" | "running" | "done" | "dismissed" | "error">("idle");
  const [note, setNote] = React.useState("");
  if (!p) return null;

  const locked = state === "running" || state === "done" || state === "dismissed";
  const set = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const addDraft = () => {
    const lines = draft.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setRows((r) => [...r, ...lines.map((t) => ({ title: t, key: seq++ }))]);
    setDraft("");
  };
  const items = rows.filter((r) => r.title.trim());

  async function save() {
    setState("running");
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            ...action,
            punch: { ...p!, list_title: p!.list_id ? p!.list_title : title.trim() || "Punch List", items: items.map(({ key: _k, ...d }) => d) },
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error ?? "Couldn't save the punch list.");
      setState("done");
      setNote(json.result?.message ?? "Saved.");
    } catch (e) {
      setState("error");
      setNote((e as Error).message);
    }
  }

  const selectCls = "h-8 rounded-md border border-border bg-background px-1.5 text-xs";
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-start gap-2">
        <ClipboardCheck className="mt-1.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          {p.list_id
            ? <div className="text-sm font-medium">Add to “{p.list_title}”</div>
            : <input value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} aria-label="List title"
                className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm font-medium outline-none focus:border-accent" />}
          <div className="mt-0.5 text-xs text-muted-foreground">{PARENT_LABEL[p.parent_type]} · {p.parent_label}{p.client_visible ? " · visible to client" : ""}</div>
        </div>
      </div>

      {!locked && meta && meta.staff.length > 0 && rows.length > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          Assign all to
          <select className={selectCls} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) setRows((r) => r.map((x) => ({ ...x, assigned_to: v === "__none" ? null : v }))); e.target.value = ""; }}>
            <option value="">Choose…</option>
            <option value="__none">Unassigned</option>
            {meta.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <ul className="mt-2 space-y-1.5 rounded-md border border-border bg-card p-2">
        {rows.length === 0 && <li className="px-1 py-1 text-xs text-muted-foreground">No items yet — add some below, or save an empty list and fill it in later.</li>}
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
            <input value={r.title} disabled={locked} onChange={(e) => set(r.key, { title: e.target.value })}
              className="h-8 min-w-0 flex-1 basis-full rounded border border-transparent bg-transparent px-1.5 text-sm hover:border-border focus:border-accent focus:outline-none sm:basis-auto" />
            {r.location && <span className="shrink-0 text-[11px] text-muted-foreground">{r.location}</span>}
            <select className={selectCls} disabled={locked || !meta} value={r.assigned_to ?? ""} onChange={(e) => set(r.key, { assigned_to: e.target.value || null })} aria-label="Assign to">
              <option value="">Unassigned</option>
              {meta?.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" className={selectCls} disabled={locked} value={r.due_date ?? ""} onChange={(e) => set(r.key, { due_date: e.target.value || null })} aria-label="Due date" />
            {!locked && (
              <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label="Remove item"
                className="rounded p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </li>
        ))}
        {!locked && (
          <li className="flex items-center gap-1.5 pt-1">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an item…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={addDraft} disabled={!draft.trim()} aria-label="Add item"
              className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground disabled:opacity-50"><Plus className="h-4 w-4" /></button>
          </li>
        )}
      </ul>

      {state === "done" ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> {note} <Link href={hrefFor(p.parent_type, p.parent_id)} className="font-medium text-accent hover:underline">Open list →</Link>
        </div>
      ) : state === "dismissed" ? (
        <div className="mt-2 text-xs text-muted-foreground">Dismissed — nothing was saved.</div>
      ) : (
        <>
          {state === "error" && <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><X className="h-3.5 w-3.5" />{note}</div>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="accent" disabled={state === "running" || (!!p.list_id && !items.length)} onClick={() => void save()}>
              {state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {p.list_id ? ` Add ${items.length} item${items.length === 1 ? "" : "s"}` : items.length ? ` Save list (${items.length})` : " Save empty list"}
            </Button>
            <Button size="sm" variant="outline" disabled={state === "running"} onClick={() => setState("dismissed")}>Dismiss</Button>
          </div>
        </>
      )}
    </div>
  );
}
