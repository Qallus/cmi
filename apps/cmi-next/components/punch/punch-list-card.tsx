"use client";

// One punch list: progress, one-tap checkboxes (big enough for a thumb on a
// job site), quick add with dictation, and the list menu (edit, add items,
// save as template, archive, delete).
import * as React from "react";
import Link from "next/link";
import {
  Archive, ArchiveRestore, BookmarkPlus, Check, ChevronDown, Eye, FileUp, Loader2, Mic,
  MoreHorizontal, Pencil, Plus, Trash2, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-action";
import { PARENT_LABEL, type PunchItem, type PunchItemDraft, type PunchList } from "@/lib/punch/types";
import { api, formatDue, PARENT_ICON, type PunchMeta } from "./shared";
import { ItemDrawer } from "./item-drawer";
import { AddItemsDialog } from "./add-items-dialog";
import { ListDialog, SaveTemplateDialog } from "./list-dialog";

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export function PunchListCard({ list: initial, meta, showParent, onChanged, onRemoved, onMetaChanged }: {
  list: PunchList;
  meta: PunchMeta;
  /** On the all-lists page, show which Job / Pre-Con / deal it belongs to. */
  showParent?: boolean;
  onChanged?: (list: PunchList) => void;
  onRemoved?: (id: string) => void;
  onMetaChanged?: () => void;
}) {
  const [list, setList] = React.useState(initial);
  React.useEffect(() => setList(initial), [initial]);
  const [hideDone, setHideDone] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [quick, setQuick] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState<PunchItem | null>(null);
  const [dialog, setDialog] = React.useState<null | "edit" | "template" | "dictate" | "import" | "paste">(null);
  const [error, setError] = React.useState<string | null>(null);

  const total = list.items.length;
  const done = list.items.filter((i) => i.completed_at).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const visible = hideDone ? list.items.filter((i) => !i.completed_at) : list.items;
  const canWrite = meta.canWrite;

  function commit(next: PunchList) { setList(next); onChanged?.(next); }
  function patchItem(item: PunchItem) { commit({ ...list, items: list.items.map((i) => (i.id === item.id ? item : i)) }); }

  async function toggle(item: PunchItem) {
    if (!canWrite) return;
    const wasDone = !!item.completed_at;
    const optimistic = { ...item, completed_at: wasDone ? null : new Date().toISOString() };
    patchItem(optimistic);
    try {
      const saved = await api<PunchItem>(`/api/punch-items/${item.id}`, { method: "PATCH", json: { done: !wasDone } });
      patchItem({ ...saved, assignee_name: item.assignee_name });
    } catch (e) {
      patchItem(item);
      setError((e as Error).message);
    }
  }

  async function addItems(drafts: PunchItemDraft[]) {
    const created = await api<PunchItem[]>(`/api/punch-lists/${list.id}/items`, { method: "POST", json: { items: drafts } });
    const named = created.map((c) => ({ ...c, assignee_name: meta.staff.find((s) => s.id === c.assigned_to)?.name ?? null }));
    commit({ ...list, items: [...list.items, ...named] });
  }

  async function quickAdd() {
    const text = quick.trim();
    if (!text) return;
    setAdding(true); setError(null);
    try {
      // Pasting several lines adds several items.
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      await addItems(lines.map((title) => ({ title })));
      setQuick("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function setArchived(archived: boolean) {
    setMenu(false);
    if (archived && !(await confirmAction({ title: `Archive “${list.title}”?`, tone: "archive", body: "It's hidden from this record but keeps every item, and can be restored." }))) return;
    try {
      const saved = await api<PunchList>(`/api/punch-lists/${list.id}`, { method: "PATCH", json: { archived } });
      commit(saved);
      if (archived) onRemoved?.(list.id);
    } catch (e) { setError((e as Error).message); }
  }

  async function remove() {
    setMenu(false);
    if (!(await confirmAction({
      title: `Delete “${list.title}”?`, tone: "danger",
      body: `All ${total} item${total === 1 ? "" : "s"} go with it and can't be recovered. Archive instead if you may need it later.`,
    }))) return;
    try {
      await api(`/api/punch-lists/${list.id}`, { method: "DELETE" });
      onRemoved?.(list.id);
    } catch (e) { setError((e as Error).message); }
  }

  const ParentIcon = list.parent ? PARENT_ICON[list.parent.type] : null;
  const menuItem = (Icon: typeof Pencil, label: string, run: () => void, danger?: boolean) => (
    <button type="button" onClick={() => { setMenu(false); run(); }}
      className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted", danger && "text-destructive")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <section className={cn("rounded-xl border border-border bg-card", list.archived_at && "opacity-70")}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand" : "Collapse"}
          className="mt-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn("h-4 w-4 transition", collapsed && "-rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          {showParent && list.parent && ParentIcon && (
            <Link href={list.parent.href} className="mb-0.5 inline-flex max-w-full items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-accent">
              <ParentIcon className="h-3 w-3 shrink-0" /> <span className="truncate">{PARENT_LABEL[list.parent.type]} · {list.parent.label}</span>
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold leading-tight">{list.title}</h3>
            {list.client_visible && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent"><Eye className="h-3 w-3" /> Client can see</span>}
            {list.archived_at && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Archived</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
          </div>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label="List actions"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                {menuItem(Check, hideDone ? "Show done items" : "Hide done items", () => setHideDone((h) => !h))}
                {canWrite && <>
                  {menuItem(Pencil, "Edit list", () => setDialog("edit"))}
                  {menuItem(Mic, "Dictate items", () => setDialog("dictate"))}
                  {menuItem(FileUp, "Import items", () => setDialog("import"))}
                  {menuItem(BookmarkPlus, "Save as template", () => setDialog("template"))}
                  {list.archived_at
                    ? menuItem(ArchiveRestore, "Restore", () => void setArchived(false))
                    : menuItem(Archive, "Archive", () => void setArchived(true))}
                  {menuItem(Trash2, "Delete", () => void remove(), true)}
                </>}
              </div>
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {list.description && (
            <div className="prose prose-sm mx-4 mb-3 max-w-none rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: list.description }} />
          )}
          {error && <div className="mx-4 mb-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

          {/* Items */}
          <ul className="divide-y divide-border border-t border-border">
            {visible.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {total === 0 ? "No items yet — add one below, dictate, or import." : "Everything on this list is done."}
              </li>
            )}
            {visible.map((item) => {
              const isDone = !!item.completed_at;
              const due = formatDue(item.due_date);
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => void toggle(item)} disabled={!canWrite}
                    aria-label={isDone ? "Mark not done" : "Mark done"} aria-pressed={isDone}
                    className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition sm:h-6 sm:w-6",
                      isDone ? "border-success bg-success text-white" : "border-border hover:border-accent")}>
                    {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <button type="button" onClick={() => setEditing(item)} className="min-w-0 flex-1 py-0.5 text-left">
                    <div className={cn("text-sm leading-snug", isDone && "text-muted-foreground line-through")}>{item.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {item.location && <span>{item.location}</span>}
                      {item.trade && <span>{item.trade}</span>}
                      {item.assignee_name && <span className="inline-flex items-center gap-0.5"><User className="h-3 w-3" />{item.assignee_name}</span>}
                      {due && !isDone && <span className={cn(due.overdue && "font-medium text-destructive")}>Due {due.text}</span>}
                      {PRIORITY_TONE[item.priority] && !isDone && <span className={cn("rounded px-1.5 py-px font-medium capitalize", PRIORITY_TONE[item.priority])}>{item.priority}</span>}
                      {item.notes && <span className="italic">has notes</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Quick add */}
          {canWrite && !list.archived_at && (
            <div className="flex items-center gap-2 border-t border-border p-3">
              <textarea
                value={quick} rows={1}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void quickAdd(); } }}
                placeholder="Add an item…"
                className="min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button type="button" onClick={() => setDialog("dictate")} aria-label="Dictate items" title="Dictate items"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-accent">
                <Mic className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void quickAdd()} disabled={adding || !quick.trim()} aria-label="Add item"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground disabled:opacity-50">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          )}
        </>
      )}

      <ItemDrawer
        item={editing} meta={meta}
        onClose={() => setEditing(null)}
        onSaved={patchItem}
        onDeleted={(id) => commit({ ...list, items: list.items.filter((i) => i.id !== id) })}
      />
      {dialog === "edit" && <ListDialog meta={meta} list={list} onClose={() => setDialog(null)} onSaved={commit} />}
      {dialog === "template" && <SaveTemplateDialog list={list} onClose={() => setDialog(null)} onSaved={() => onMetaChanged?.()} />}
      {(dialog === "dictate" || dialog === "import" || dialog === "paste") && (
        <AddItemsDialog listTitle={list.title} meta={meta} initialMode={dialog} onClose={() => setDialog(null)} onAdd={addItems} />
      )}
    </section>
  );
}
