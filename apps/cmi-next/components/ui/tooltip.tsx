"use client";

// shadcn/ui Tooltip on Radix: theme-aware (the bubble inverts with light / dark
// mode), portalled so scroll containers don't clip it, and collision-aware (it
// flips or shifts instead of running off screen).
//
// - <Tooltip label side>: the one-liner used across the dashboard.
// - <AutoTooltip content>: picks top / bottom / left / right from where the
//   trigger sits on screen (Gantt bars, grid cells).
// - TooltipProvider / TooltipRoot / TooltipTrigger / TooltipContent: the
//   shadcn primitives, for anything custom.
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

const TooltipProvider = ({ delayDuration = 150, skipDelayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
);
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "z-[9999] max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] animate-tooltip-in rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-foreground" width={10} height={5} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** The dashboard's everyday tooltip. Wraps its trigger in a block span. */
export function Tooltip({
  label, side = "right", delay = 120, className, children,
}: {
  label: React.ReactNode;
  side?: Side;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  if (label == null || label === "") return <>{children}</>;
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className={cn("block", className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

/** Which side has room: above or below unless the trigger is narrow and near
 *  a left / right edge, then beside it. Radix still flips if that runs out. */
function bestSide(el: Element | null, prefer: "vertical" | "horizontal"): Side {
  if (!el || typeof window === "undefined") return "top";
  const r = el.getBoundingClientRect();
  const w = window.innerWidth, h = window.innerHeight;
  const room = { top: r.top, bottom: h - r.bottom, left: r.left, right: w - r.right };
  if (prefer === "horizontal" || r.width < 48) {
    if (room.right >= 240 || room.left >= 240) return room.right >= room.left ? "right" : "left";
  }
  return room.top >= 140 || room.top >= room.bottom ? "top" : "bottom";
}

/**
 * A tooltip that places itself by where its trigger is on screen. The child
 * must be one element that can take a ref (a div, button or span).
 */
export function AutoTooltip({
  content, children, disabled, prefer = "vertical", delay = 150, className,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
  prefer?: "vertical" | "horizontal";
  delay?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [side, setSide] = React.useState<Side>("top");
  const [open, setOpen] = React.useState(false);
  if (content == null || content === "") return children;
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot open={!disabled && open} onOpenChange={(o) => { if (o) setSide(bestSide(ref.current, prefer)); setOpen(o); }}>
        <TooltipTrigger asChild ref={ref as React.Ref<HTMLButtonElement>}>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>{content}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
