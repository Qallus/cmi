"use client";

import * as React from "react";
import { Eraser, MapPin, Mic, MousePointer2, Pencil, PenTool, Shapes, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CANVAS_COLORS, EMPTY_ANNOTATIONS, type CanvasColor } from "@/lib/canvas/types";
import type { CanvasStore, Tool } from "./use-canvas-store";

const TOOLS: { key: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "draw", label: "Draw", icon: Pencil },
  { key: "shape", label: "Shape", icon: PenTool },
  { key: "pin", label: "Pin note", icon: MapPin },
  { key: "voice", label: "Voice pin", icon: Mic },
  { key: "stamp", label: "Elements", icon: Shapes },
];

const SWATCHES: { color: CanvasColor; label: string }[] = [
  { color: CANVAS_COLORS.gold, label: "Gold — general" },
  { color: CANVAS_COLORS.red, label: "Red — remove" },
  { color: CANVAS_COLORS.green, label: "Green — add" },
  { color: CANVAS_COLORS.white, label: "White — neutral" },
];

export function Toolbar({ store }: { store: CanvasStore }) {
  const disabled = store.readOnly;

  function undo() {
    store.mutateActiveAnnotations((a) => {
      if (a.stamps.length) return { ...a, stamps: a.stamps.slice(0, -1) };
      if (a.pins.length) return { ...a, pins: a.pins.slice(0, -1) };
      if (a.shapes.length) return { ...a, shapes: a.shapes.slice(0, -1) };
      if (a.strokes.length) return { ...a, strokes: a.strokes.slice(0, -1) };
      return a;
    });
  }
  function clear() {
    store.mutateActiveAnnotations(() => ({ ...EMPTY_ANNOTATIONS }));
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2.5" role="toolbar" aria-label="Annotation tools">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const on = store.tool === t.key;
        return (
          <button
            key={t.key}
            type="button"
            disabled={disabled && t.key !== "select"}
            aria-pressed={on}
            onClick={() => store.setTool(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              on ? "border-accent/40 bg-accent/10 text-accent" : "border-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}

      <div className="mx-1.5 h-5 w-px bg-border" />

      <div className="flex items-center gap-1.5 px-1" aria-label="Marker color">
        {SWATCHES.map((s) => (
          <button
            key={s.color}
            type="button"
            title={s.label}
            aria-label={s.label}
            aria-pressed={store.color === s.color}
            disabled={disabled}
            onClick={() => store.setColor(s.color)}
            className={cn("rounded-full outline outline-1 outline-border transition disabled:opacity-40", store.color === s.color && "outline-2 outline-accent")}
            style={{ background: s.color, width: 18, height: 18 }}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" disabled={disabled} onClick={undo} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
          <Undo2 className="h-4 w-4" /><span className="hidden sm:inline">Undo</span>
        </button>
        <button type="button" disabled={disabled} onClick={clear} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
          <Eraser className="h-4 w-4" /><span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  );
}
