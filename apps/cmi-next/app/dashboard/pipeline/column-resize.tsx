"use client";

// Resizable columns for the Pipeline Table view. Drag the right edge of a
// header to change that column's width; double-click the edge to put it back.
// Widths are a per-browser convenience, kept in localStorage. The columns
// fill the table's width together (see lib/ui/column-layout.ts).
import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutColumns } from "@/lib/ui/column-layout";

const MIN = 56;
const MAX = 800;

function readStored(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.min(MAX, Math.max(MIN, Math.round(v)));
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(key: string, widths: Record<string, number>) {
  try {
    if (Object.keys(widths).length) window.localStorage.setItem(key, JSON.stringify(widths));
    else window.localStorage.removeItem(key);
  } catch {
    // Private windows or blocked storage: widths just won't persist.
  }
}

export type ColumnWidths = {
  /** The column being dragged right now, if any. */
  dragging: string | null;
  /** Widths for the visible columns, filling `available` px (0 = not measured yet). */
  layout: (keys: string[], available: number) => { widths: Record<string, number>; total: number };
  /** True when the person has changed at least one column. */
  customized: boolean;
  /** Pointer-down handler for a column's drag handle. */
  startResize: (col: string, e: React.PointerEvent<HTMLElement>) => void;
  resetColumn: (col: string) => void;
  resetAll: () => void;
};

/**
 * `defaults` gives each column's starting width. A column left out of it is
 * "auto" and takes the space the others leave, until someone resizes it.
 */
export function useColumnWidths(storageKey: string, defaults: Record<string, number>): ColumnWidths {
  const [custom, setCustom] = React.useState<Record<string, number>>({});
  // Read after mount so the server render and the first client render match.
  React.useEffect(() => {
    // eslint-disable-next-line -- one-time restore of the saved widths on mount (same as useColumnPrefs)
    setCustom(readStored(storageKey));
  }, [storageKey]);

  const [dragging, setDragging] = React.useState<string | null>(null);
  const layout = React.useCallback(
    (keys: string[], available: number) => layoutColumns({ keys, defaults, custom, available, pinned: dragging }),
    [custom, defaults, dragging],
  );

  const startResize = React.useCallback((col: string, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    const startX = e.clientX;
    const startW = th ? th.getBoundingClientRect().width : (custom[col] ?? defaults[col] ?? 160);
    let latest = startW;
    // Pin the column while dragging so it follows the mouse; start it at the
    // width it's showing, not its stored width, so it doesn't jump.
    setDragging(col);
    setCustom((cur) => ({ ...cur, [col]: Math.round(startW) }));
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      latest = Math.min(MAX, Math.max(MIN, Math.round(startW + ev.clientX - startX)));
      setCustom((cur) => (cur[col] === latest ? cur : { ...cur, [col]: latest }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      setDragging(null);
      setCustom((cur) => {
        const next = { ...cur, [col]: latest };
        writeStored(storageKey, next);
        return next;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [custom, defaults, storageKey]);

  const resetColumn = React.useCallback((col: string) => {
    setCustom((cur) => {
      if (!(col in cur)) return cur;
      const next = { ...cur };
      delete next[col];
      writeStored(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const resetAll = React.useCallback(() => { setCustom({}); writeStored(storageKey, {}); }, [storageKey]);

  return { dragging, layout, customized: Object.keys(custom).length > 0, startResize, resetColumn, resetAll };
}

/** The drag handle on a header's right edge. The header must be `relative`. */
export function ResizeHandle({ col, label, widths }: { col: string; label: string; widths: ColumnWidths }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => widths.startResize(col, e)}
      onDoubleClick={(e) => { e.stopPropagation(); widths.resetColumn(col); }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute -right-1.5 top-0 z-10 h-full w-3 cursor-col-resize touch-none select-none",
        "after:absolute after:inset-y-1 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-transparent after:transition",
        "hover:after:bg-accent active:after:bg-accent",
      )}
    />
  );
}

/** The element's inner width, kept up to date as it resizes (0 until measured). */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
