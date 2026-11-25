"use client";

// A Claude-written (or hand-written) invitation design, shown in a sandboxed
// iframe. `allow-scripts` without `allow-same-origin` gives it an opaque
// origin: its animations run, but it can't read CMI cookies, storage or the
// page around it. It reports its height with postMessage so it sits inline.
import * as React from "react";
import { frameDocument } from "@/lib/events/custom-frame";

export function CustomDesignFrame({ html, title }: { html: string; title: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(520);
  const doc = React.useMemo(() => frameDocument(html), [html]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return;
      const h = Number((e.data as { cmiInviteHeight?: unknown })?.cmiInviteHeight);
      if (Number.isFinite(h) && h > 40) setHeight(Math.min(Math.ceil(h), 6000));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={doc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ display: "block", width: "100%", height, border: 0 }}
    />
  );
}
