"use client";

// A card's place on the dashboard: its width (by size), and in Customize mode
// a bar to drag it, resize it, hide it or remove it. Outside Customize a small
// hide button shows on hover. (From Echo; the size slider is a menu here.)
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Eye, EyeOff, GripVertical, Scaling, Trash2 } from "lucide-react";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { CARDS } from "@/lib/dashboard/cards";
import { SIZES, type Card, type Size } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";

const ROW: Record<Size, string> = {
  xs: "w-[10.5rem] sm:w-[11.5rem]",
  sm: "w-[14rem] sm:w-[15.5rem]",
  md: "w-[85vw] max-w-[21rem] sm:w-[21rem]",
  lg: "w-[88vw] max-w-[30rem] sm:w-[30rem]",
  xl: "w-full",
};
const GRID: Record<Size, string> = {
  xs: "col-span-1 sm:col-span-2",
  sm: "col-span-2 sm:col-span-3",
  md: "col-span-2 sm:col-span-3 lg:col-span-4",
  lg: "col-span-2 sm:col-span-6",
  xl: "col-span-2 sm:col-span-6 lg:col-span-12",
};
const LABEL: Record<Size, string> = { xs: "Small", sm: "Medium", md: "Large", lg: "Wide", xl: "Full width" };

export function CardShell({ card, sectionId, style, edit, children, onSize, onHide, onRemove }: {
  card: Card; sectionId: string; style: "row" | "grid"; edit: boolean; children: React.ReactNode;
  onSize: (s: Size) => void; onHide: (hidden: boolean) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id, data: { kind: "card", section: sectionId }, disabled: !edit,
  });
  const meta = CARDS[card.type];
  const btn = "grid size-7 place-items-center rounded-md hover:bg-muted";
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/card relative flex min-w-0 flex-col", style === "row" ? cn("shrink-0 snap-start", ROW[card.size]) : GRID[card.size],
        isDragging && "z-20 opacity-60", edit && card.hidden && "opacity-45")}>
      {edit && (
        <div className="mb-1.5 flex shrink-0 items-center gap-1 rounded-xl border border-border bg-background/95 px-1.5 py-1 text-xs shadow-sm">
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move ${meta.title}`}
            className={cn(btn, "cursor-grab touch-none active:cursor-grabbing")}>
            <GripVertical className="size-4" />
          </button>
          <span className="min-w-0 flex-1 truncate font-medium">{meta.title}{card.hidden ? " · hidden" : ""}</span>
          <span title={`Size: ${LABEL[card.size]}`}>
            <RowActionsMenu label={`Size of ${meta.title}`} className="size-7"
              items={SIZES.map((s) => ({ key: s, label: LABEL[s], icon: s === card.size ? Check : Scaling, run: () => onSize(s) }))} />
          </span>
          <button type="button" onClick={() => onHide(!card.hidden)} aria-label={card.hidden ? "Show" : "Hide"} title={card.hidden ? "Show" : "Hide"} className={btn}>
            {card.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button type="button" onClick={onRemove} aria-label="Remove" title="Remove" className={cn(btn, "text-destructive hover:bg-destructive/10")}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
      <div className={cn("min-h-0 flex-1 [&>*]:h-full", edit && "pointer-events-none select-none")}>{children}</div>
      {!edit && card.type !== "get_started" && card.type !== "whats_new" && card.type !== "my_tasks" && (
        <button type="button" onClick={() => onHide(true)} aria-label={`Hide ${meta.title}`} title="Hide"
          className="absolute -right-2 -top-2 z-10 hidden size-6 place-items-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100 md:grid">
          <EyeOff className="size-3" />
        </button>
      )}
    </div>
  );
}
