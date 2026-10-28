"use client";

// The dashboard's row ⋯ menu, as a generic component: same look and behavior
// as the Pipeline / Pre-Con / Jobs menus (app/dashboard/pipeline/deal-actions.tsx),
// fixed to the viewport so a scrolling list can't clip it, closing on outside
// click, scroll or resize. The menu renders into <body> (a portal) so a pinned
// (sticky) table column, which paints its own layer, can't draw over it. Pass the items; each module keeps its own actions.
import * as React from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowAction = { key: string; label: string; icon: LucideIcon; run: () => void; danger?: boolean; hidden?: boolean; disabled?: boolean };

export function RowActionsMenu({ items, label, className }: { items: RowAction[]; label: string; className?: string }) {
  const [at, setAt] = React.useState<{ top: number; left: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);
  const open = at !== null;

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setAt(null);
    };
    const dismiss = () => setAt(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAt(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (at) { setAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const width = 200, height = visible.length * 34 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
    setAt({ top, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) });
  }

  if (!visible.length) return null;
  return (
    <div ref={ref} className={cn("relative", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {at && createPortal(
        <div ref={menuRef} role="menu" style={{ top: at.top, left: at.left }} onClick={(e) => e.stopPropagation()}
          className="fixed z-[65] w-[200px] rounded-md border border-border bg-card p-1 text-sm shadow-lg">
          {visible.map((i) => (
            <button
              key={i.key} type="button" role="menuitem" disabled={i.disabled}
              onClick={() => { setAt(null); i.run(); }}
              className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40", i.danger && "text-destructive")}
            >
              <i.icon className="h-3.5 w-3.5" /> {i.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
