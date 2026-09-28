"use client";

import * as React from "react";
import { Maximize2, Minimize2, Monitor, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_WIDTH = 390;

/**
 * An email preview that can be opened out to fill the screen.
 *
 * Both places that show a rendered email use this: the builder's Full Preview
 * and the template preview inside Compose. Inline it is a short, fixed-height
 * frame; expanded it takes the window, which is the only way to judge a long
 * email. The phone/desktop toggle matters because most of these are read on a
 * phone.
 */
export function EmailPreview({
  html, width = 600, className, inlineHeight = 256, startExpanded = false, onClose,
}: {
  html: string;
  /** The email's own width, so the desktop view matches what will be sent. */
  width?: number;
  className?: string;
  inlineHeight?: number;
  startExpanded?: boolean;
  /** Present when this is a standalone modal rather than an inline frame. */
  onClose?: () => void;
}) {
  const [expanded, setExpanded] = React.useState(startExpanded);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");

  // Escape closes the expanded view, or the whole thing when it opened expanded.
  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (startExpanded && onClose) onClose();
      else setExpanded(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded, startExpanded, onClose]);

  const frameWidth = device === "mobile" ? MOBILE_WIDTH : width;

  const frame = (fill: boolean) => (
    <iframe
      srcDoc={html || "<p style=\"padding:16px;color:#888;font-family:sans-serif;font-size:13px\">Nothing to preview yet.</p>"}
      title="Email preview"
      sandbox="allow-same-origin"
      style={{ width: frameWidth }}
      className={cn(
        "mx-auto block max-w-full border-0 bg-white",
        fill ? "h-full rounded-lg shadow" : "",
      )}
      height={fill ? undefined : inlineHeight}
    />
  );

  const controls = (
    <div className="flex items-center gap-1">
      <div className="mr-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
        <button
          type="button" onClick={() => setDevice("desktop")} aria-label="Desktop width"
          aria-pressed={device === "desktop"}
          className={cn("rounded p-1 transition", device === "desktop" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
        <button
          type="button" onClick={() => setDevice("mobile")} aria-label="Phone width"
          aria-pressed={device === "mobile"}
          className={cn("rounded p-1 transition", device === "mobile" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </button>
      </div>
      {startExpanded && onClose ? (
        <button
          type="button" onClick={onClose} aria-label="Close preview"
          className="rounded-md border border-border px-3 py-1 text-xs transition hover:bg-muted"
        >
          Close
        </button>
      ) : (
        <button
          type="button" onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Shrink preview" : "Expand preview"}
          title={expanded ? "Shrink" : "Expand to full screen"}
          className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-semibold">Email preview</span>
          <div className="flex items-center gap-2">
            {controls}
            {!startExpanded && (
              <button
                type="button" onClick={() => setExpanded(false)} aria-label="Close"
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#f4f4f4] p-6">
          {frame(true)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1">
        <span className="pl-1 text-[11px] text-muted-foreground">
          {device === "mobile" ? `${MOBILE_WIDTH}px` : `${width}px`}
        </span>
        {controls}
      </div>
      <div className="overflow-auto bg-[#f4f4f4] p-2" style={{ height: inlineHeight + 16 }}>
        {frame(false)}
      </div>
    </div>
  );
}
