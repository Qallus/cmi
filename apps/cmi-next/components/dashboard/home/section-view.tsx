"use client";

// A section: its header (title, collapse, hide; in Customize also rename, row
// or grid, delete and a drag handle) and its cards, in one row that slides
// sideways or in a grid. (From Echo.)
import { useDroppable } from "@dnd-kit/core";
import { horizontalListSortingStrategy, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Columns3, EyeOff, GripVertical, LayoutGrid, Plus, Rows3, Trash2 } from "lucide-react";
import type { Section } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";
import { SlideRow } from "./slide-row";

export function SectionView({ section, edit, children, onChange, onRemove, onAdd }: {
  section: Section; edit: boolean; children: React.ReactNode;
  onChange: (patch: Partial<Section>) => void; onRemove: () => void; onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id, data: { kind: "section" }, disabled: !edit,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop:${section.id}`, data: { kind: "drop", section: section.id }, disabled: !edit });
  const visible = edit ? section.cards : section.cards.filter((c) => !c.hidden);
  if (!edit && (section.hidden || !visible.length)) return null;
  const ids = section.cards.map((c) => c.id);
  const iconBtn = "grid size-7 place-items-center rounded-md hover:bg-muted";

  return (
    <section ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} aria-label={section.title}
      className={cn("space-y-2.5", isDragging && "z-30 opacity-70", edit && "rounded-2xl border border-dashed border-border p-3", edit && section.hidden && "opacity-50")}>
      <header className="flex min-h-8 items-center gap-1.5">
        {edit && (
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move section ${section.title}`}
            className={cn(iconBtn, "cursor-grab touch-none active:cursor-grabbing")}><GripVertical className="size-4" /></button>
        )}
        {edit ? (
          <input value={section.title} onChange={(e) => onChange({ title: e.target.value.slice(0, 60) })} aria-label="Section name"
            className="h-8 max-w-56 rounded-md border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-accent" />
        ) : (
          <button type="button" onClick={() => onChange({ collapsed: !section.collapsed })} aria-expanded={!section.collapsed}
            className="flex items-center gap-1 text-sm font-semibold tracking-tight hover:text-muted-foreground">
            {section.title}<ChevronDown className={cn("size-4 transition-transform", section.collapsed && "-rotate-90")} />
          </button>
        )}
        <span className="flex-1" />
        {edit ? (
          <>
            <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Layout">
              <button type="button" role="radio" aria-checked={section.style === "row"} onClick={() => onChange({ style: "row" })} title="One row that slides"
                className={cn("grid size-7 place-items-center rounded-md", section.style === "row" ? "bg-muted" : "text-muted-foreground")}><Columns3 className="size-3.5" /></button>
              <button type="button" role="radio" aria-checked={section.style === "grid"} onClick={() => onChange({ style: "grid" })} title="Grid"
                className={cn("grid size-7 place-items-center rounded-md", section.style === "grid" ? "bg-muted" : "text-muted-foreground")}><LayoutGrid className="size-3.5" /></button>
            </div>
            <button type="button" onClick={() => onChange({ hidden: !section.hidden })} className="rounded-md px-2 py-1 text-sm hover:bg-muted">{section.hidden ? "Show" : "Hide"}</button>
            <button type="button" onClick={onRemove} aria-label="Delete section" title="Delete section" className={cn(iconBtn, "text-destructive")}><Trash2 className="size-4" /></button>
          </>
        ) : (
          <button type="button" onClick={() => onChange({ hidden: true })} aria-label={`Hide ${section.title}`} title="Hide section"
            className={cn(iconBtn, "text-muted-foreground")}><EyeOff className="size-4" /></button>
        )}
      </header>

      {!section.collapsed && (
        <div ref={setDropRef} className={cn(edit && isOver && "rounded-xl bg-accent/5 ring-2 ring-accent/30")}>
          <SortableContext items={ids} strategy={section.style === "row" ? horizontalListSortingStrategy : rectSortingStrategy}>
            {section.style === "row" ? (
              <SlideRow label={section.title}>{children}{edit && <AddTile onAdd={onAdd} row />}</SlideRow>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-12">{children}{edit && <AddTile onAdd={onAdd} />}</div>
            )}
          </SortableContext>
        </div>
      )}
      {edit && !section.collapsed && !section.cards.length && <p className="text-xs text-muted-foreground"><Rows3 className="mr-1 inline size-3.5" />Drag cards here, or add one.</p>}
    </section>
  );
}

function AddTile({ onAdd, row }: { onAdd: () => void; row?: boolean }) {
  return (
    <button type="button" onClick={onAdd}
      className={cn("flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-accent/50 hover:text-foreground",
        row ? "w-40 shrink-0 snap-start" : "col-span-1 sm:col-span-2")}>
      <Plus className="size-5" /> Add card
    </button>
  );
}
