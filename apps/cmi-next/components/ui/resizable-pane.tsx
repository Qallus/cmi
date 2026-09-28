"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A draggable width for a side panel, remembered per person.
 *
 * `side` is which edge the handle sits on, which decides the sign of the drag:
 * widening a left panel means moving right, widening a right panel means
 * moving left.
 */
export function useResizablePane(
  storageKey: string,
  defaultWidth: number,
  { min = 160, max = 520, side = "left" }: { min?: number; max?: number; side?: "left" | "right" } = {},
) {
  const [width, setWidth] = React.useState(defaultWidth);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(storageKey); } catch { /* private window */ }
    const n = Number(saved);
    if (!saved || !Number.isFinite(n)) return;
    // eslint-disable-next-line -- one-time restore of saved preference on mount
    setWidth(Math.min(max, Math.max(min, n)));
  }, [storageKey, min, max]);

  const start = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      setWidth(Math.min(max, Math.max(min, startWidth + delta)));
    };
    const end = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      // Read the committed width off the element rather than this closure,
      // which still holds the width from when the drag began.
      setWidth((w) => { try { window.localStorage.setItem(storageKey, String(w)); } catch { /* fine */ } return w; });
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    // Held on the body so the cursor survives leaving the 5px handle.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width, min, max, side, storageKey]);

  /** Keyboard resizing, so the panel is not mouse-only. */
  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 48 : 16;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = width + (side === "left" ? -step : step);
    if (e.key === "ArrowRight") next = width + (side === "left" ? step : -step);
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.min(max, Math.max(min, next));
    setWidth(clamped);
    try { window.localStorage.setItem(storageKey, String(clamped)); } catch { /* fine */ }
  }, [width, min, max, side, storageKey]);

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        setWidth(defaultWidth);
        try { window.localStorage.setItem(storageKey, String(defaultWidth)); } catch { /* fine */ }
      }}
      title="Drag to resize · double-click to reset"
      className={cn(
        "group relative w-1 shrink-0 cursor-col-resize bg-border transition-colors",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        dragging && "bg-accent",
      )}
    >
      {/* A wider invisible target than the 4px line, so it is grabbable. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );

  return { width, handle, dragging };
}
