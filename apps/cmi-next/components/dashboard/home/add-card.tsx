"use client";

// "Add card": every card this person can use, by category, with search. Pick
// which section it goes in (or a new one). Cards you can only have one of say
// "Added" once they're on the dashboard (or "Show" if hidden). (From Echo.)
import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { CARDS, CATEGORIES, CATEGORY_ICON, type Category } from "@/lib/dashboard/cards";
import { CARD_TYPES, type CardType, type Layout } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";
import { ResponsivePanel } from "./responsive-panel";

export const NEW_SECTION = "__new__";

export function AddCardPanel({ open, onOpenChange, layout, target, onTarget, onAdd, onShow, allowed }: {
  open: boolean; onOpenChange: (o: boolean) => void; layout: Layout; target: string; onTarget: (id: string) => void;
  onAdd: (type: CardType) => void; onShow: (type: CardType) => void; allowed: (t: CardType) => boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const placed = new Map(layout.sections.flatMap((s) => s.cards.map((c) => [c.type, c] as const)));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const usable = CARD_TYPES.filter(allowed);
  const cats = CATEGORIES.filter((c) => usable.some((t) => CARDS[t].category === c));
  const list = usable.filter((t) => {
    const m = CARDS[t];
    if (cat !== "All" && m.category !== cat) return false;
    const text = `${m.title} ${m.what} ${m.category}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange}
      title="Add a card" description="Stats, tools, lists, calendars and charts. Move them anywhere with Customize."
      footer={
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">Add to</span>
          <select value={target} onChange={(e) => onTarget(e.target.value)} aria-label="Section"
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent">
            {layout.sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            <option value={NEW_SECTION}>A new section</option>
          </select>
        </label>
      }>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" aria-label="Search cards"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-accent" />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {(["All", ...cats] as const).map((c) => {
          const Icon = c === "All" ? null : CATEGORY_ICON[c];
          return (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                cat === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
              {Icon && <Icon className="size-3.5" />}{c}
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No card matches.</p>}
      <div className="grid gap-2">
        {list.map((t) => {
          const m = CARDS[t];
          const on = placed.get(t);
          const added = on && !m.repeat;
          return (
            <div key={t} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><m.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">{m.title}
                  <span className="rounded border border-border px-1 text-[10px] font-normal text-muted-foreground">{m.category}</span></p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.what}</p>
              </div>
              {added ? (
                on.hidden
                  ? <button type="button" onClick={() => onShow(t)} className="self-center rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Show</button>
                  : <span className="inline-flex shrink-0 items-center gap-1 self-center text-xs text-muted-foreground"><Check className="size-3.5" /> Added</span>
              ) : (
                <button type="button" onClick={() => onAdd(t)} aria-label={`Add ${m.title}`}
                  className="grid size-8 shrink-0 place-items-center self-center rounded-md border border-border hover:bg-muted"><Plus className="size-4" /></button>
              )}
            </div>
          );
        })}
      </div>
    </ResponsivePanel>
  );
}
