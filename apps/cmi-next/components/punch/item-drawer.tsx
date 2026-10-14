"use client";

// Edit one punch item in a bottom sheet (thumb-reachable on a phone).
import * as React from "react";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { confirmAction } from "@/components/ui/confirm-action";
import { cn } from "@/lib/utils";
import { PUNCH_PRIORITIES, type PunchItem, type PunchPriority } from "@/lib/punch/types";
import { api, Field, inputCls, type PunchMeta } from "./shared";

export function ItemDrawer({ item, meta, onClose, onSaved, onDeleted }: {
  item: PunchItem | null;
  meta: PunchMeta;
  onClose: () => void;
  onSaved: (item: PunchItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState<PunchItem | null>(item);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { setDraft(item); setError(null); }, [item]);

  if (!draft) return <Drawer open={false} onClose={onClose}><span /></Drawer>;
  const set = (patch: Partial<PunchItem>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const done = !!draft.completed_at;

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const saved = await api<PunchItem>(`/api/punch-items/${draft.id}`, {
        method: "PATCH",
        json: {
          title: draft.title, notes: draft.notes, location: draft.location, trade: draft.trade,
          priority: draft.priority, assigned_to: draft.assigned_to, due_date: draft.due_date,
          done: !!draft.completed_at,
        },
      });
      onSaved({ ...saved, assignee_name: meta.staff.find((s) => s.id === saved.assigned_to)?.name ?? null });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft) return;
    if (!(await confirmAction({ title: "Delete this punch item?", tone: "danger", body: `“${draft.title}” will be removed from the list.` }))) return;
    setBusy(true);
    try {
      await api(`/api/punch-items/${draft.id}`, { method: "DELETE" });
      onDeleted(draft.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !meta.canWrite;
  return (
    <Drawer open={!!item} onClose={onClose} title="Punch item" className="max-h-[92vh] overflow-y-auto">
      <div className="space-y-4 pb-2">
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <button type="button" disabled={readOnly}
          onClick={() => set({ completed_at: done ? null : new Date().toISOString() })}
          className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-medium transition",
            done ? "border-success/40 bg-success/10 text-success" : "border-border hover:bg-muted")}>
          {done ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
          {done ? `Done${draft.completed_by_name ? ` · ${draft.completed_by_name}` : ""}` : "Mark as done"}
        </button>

        <Field label="Item">
          <input className={inputCls} value={draft.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Room / area">
            <input className={inputCls} value={draft.location ?? ""} disabled={readOnly} placeholder="Kitchen" onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Trade">
            <input className={inputCls} value={draft.trade ?? ""} disabled={readOnly} placeholder="Paint" onChange={(e) => set({ trade: e.target.value })} />
          </Field>
          <Field label="Assigned to" hint="Shows up in their Daily Brief">
            <select className={inputCls} value={draft.assigned_to ?? ""} disabled={readOnly} onChange={(e) => set({ assigned_to: e.target.value || null })}>
              <option value="">Unassigned</option>
              {meta.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Due">
            <input type="date" className={inputCls} value={draft.due_date ?? ""} disabled={readOnly} onChange={(e) => set({ due_date: e.target.value || null })} />
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={draft.priority} disabled={readOnly} onChange={(e) => set({ priority: e.target.value as PunchPriority })}>
              {PUNCH_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Field>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          {readOnly
            ? <div className="prose prose-sm max-w-none rounded-md border border-border p-3 text-sm" dangerouslySetInnerHTML={{ __html: draft.notes || "<p>—</p>" }} />
            : <RichTextEditor key={draft.id} value={draft.notes ?? ""} onChange={(v) => set({ notes: v })} placeholder="Details, measurements, photos…" />}
        </div>

        {!readOnly && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove()} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy || !draft.title.trim()}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
