"use client";

import { Armchair, DoorOpen, Flame, Fence, Sprout, Warehouse } from "lucide-react";
import { STAMP_LIBRARY } from "@/lib/canvas/types";

// Icons for the v1 stamp set (STAMP_LIBRARY drives labels/kinds).
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pergola: Warehouse,
  outdoor_kitchen: Armchair,
  french_doors: DoorOpen,
  fire_pit: Flame,
  retaining_wall: Fence,
  planter_bed: Sprout,
};

export function StampTray({ onAdd }: { onAdd: (kind: string, label: string) => void }) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
      {STAMP_LIBRARY.map((s) => {
        const Icon = ICONS[s.kind] ?? Warehouse;
        return (
          <button key={s.kind} type="button" onClick={() => onAdd(s.kind, s.label)}
            className="flex w-16 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10.5px] font-semibold text-muted-foreground transition hover:bg-accent/10 hover:text-accent">
            <Icon className="h-5 w-5" />
            <span className="text-center leading-tight">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
