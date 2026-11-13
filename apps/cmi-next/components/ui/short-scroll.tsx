"use client";

// A vertical scroll area with a short, fixed-size handle in CMI colours (the
// sidebars). A native scrollbar's handle is sized by the content, so it's
// hidden and drawn here instead: drag the handle, click the track to jump, or
// scroll as usual (wheel, touch, keyboard).
import * as React from "react";
import { cn } from "@/lib/utils";

export function ShortScroll({ className, innerClassName, children, handle = 40 }: {
  className?: string; innerClassName?: string; children: React.ReactNode;
  /** Handle length in px. */
  handle?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [bar, setBar] = React.useState<{ show: boolean; top: number; track: number }>({ show: false, top: 0, track: 0 });
  const [dragging, setDragging] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const track = el.clientHeight - 8;
    if (max <= 1 || track <= handle) { setBar((b) => (b.show ? { show: false, top: 0, track } : b)); return; }
    setBar({ show: true, top: (el.scrollTop / max) * (track - handle), track });
  }, [handle]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => ro.disconnect();
  }, [update]);

  function startDrag(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const startY = e.clientY, startTop = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, bar.track - handle);
    setDragging(true);
    const move = (ev: PointerEvent) => { el.scrollTop = startTop + (ev.clientY - startY) * ratio; };
    const up = () => { setDragging(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function jump(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top - handle / 2;
    el.scrollTo({ top: (y / Math.max(1, bar.track - handle)) * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
  }

  return (
    <div className={cn("group/scroll relative min-h-0", className)}>
      <div ref={ref} onScroll={update} className={cn("h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", innerClassName)}>
        {children}
      </div>
      {bar.show ? (
        <div aria-hidden onClick={jump}
          className="absolute bottom-1 right-0.5 top-1 w-1.5 cursor-pointer rounded-full bg-[color-mix(in_oklch,var(--muted)_70%,transparent)] opacity-60 transition-opacity group-hover/scroll:opacity-100">
          <div onPointerDown={startDrag} onClick={(e) => e.stopPropagation()}
            className={cn("absolute inset-x-0 cursor-grab rounded-full transition-colors active:cursor-grabbing",
              dragging ? "bg-accent" : "bg-[color-mix(in_oklch,var(--accent)_65%,var(--muted))] hover:bg-accent")}
            style={{ top: bar.top, height: handle }} />
        </div>
      ) : null}
    </div>
  );
}
