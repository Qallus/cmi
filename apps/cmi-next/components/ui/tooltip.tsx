"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Side = "right" | "left" | "top" | "bottom";

// Branded tooltip (no external deps). Renders via a portal with fixed
// positioning so it isn't clipped by scrolling/overflow containers (e.g. the
// collapsed sidebar). The bubble inverts with the theme (dark on light,
// light on dark) like shadcn's tooltip.
export function Tooltip({
  label, side = "right", delay = 120, className, children,
}: {
  label: string;
  side?: Side;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    let x = r.right + gap, y = r.top + r.height / 2;
    if (side === "left") { x = r.left - gap; }
    else if (side === "top") { x = r.left + r.width / 2; y = r.top - gap; }
    else if (side === "bottom") { x = r.left + r.width / 2; y = r.bottom + gap; }
    setPos({ x, y });
    timer.current = setTimeout(() => setVisible(true), delay);
  }, [side, delay]);

  const hide = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
    setPos(null);
  }, []);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Transform anchors the bubble relative to the trigger per side.
  const transform =
    side === "right" ? "translateY(-50%)"
    : side === "left" ? "translate(-100%, -50%)"
    : side === "top" ? "translate(-50%, -100%)"
    : "translateX(-50%)";

  return (
    <span
      ref={wrapRef}
      className={cn("block", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {pos && typeof document !== "undefined" && createPortal(
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md transition-opacity duration-100",
            visible ? "opacity-100" : "opacity-0",
          )}
          style={{ left: pos.x, top: pos.y, transform }}
        >
          {label}
        </div>,
        document.body,
      )}
    </span>
  );
}
