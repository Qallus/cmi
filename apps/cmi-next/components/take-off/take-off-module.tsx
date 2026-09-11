"use client";

import { useEffect, useRef } from "react";
import { mountTakeOff, type RenderedPage } from "./engine.js";

export type TakeOffModuleProps = {
  /** Optional approved PDF rasterizer. No CDN fallback is installed by this module. */
  pdfRenderer?: (file: File) => Promise<RenderedPage[]>;
};

/**
 * CMI-only feature content. The existing app/dashboard/layout.tsx provides the
 * sidebar, header, account controls, theme, and mobile navigation.
 *
 * The existing dependency-free geometry/estimate UI runs in a ShadowRoot for
 * style and event isolation, mounted by this React client component. It is not
 * an iframe, a separate React application, or a replacement dashboard.
 *
 * This delivery is session-only. Do not bind sample state to production records.
 */
export default function TakeOffModule({ pdfRenderer }: TakeOffModuleProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const theme = () =>
      document.documentElement.classList.contains("dark") ||
      document.documentElement.dataset.theme === "dark"
        ? ("dark" as const)
        : ("light" as const);
    const controller = mountTakeOff(host.current, {
      theme: theme(),
      showThemeControl: false,
      pdfRenderer,
    });
    // Semantic CSS variables inherit from CMI automatically, including theme
    // changes. Updating the marker must not rerender away a drawing or dialog.
    const observer = new MutationObserver(() => controller.setTheme(theme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => {
      observer.disconnect();
      controller.destroy();
    };
  }, [pdfRenderer]);

  return (
    <div
      ref={host}
      data-cmi-take-off
      aria-label="Take-Off: plan measurements and estimating preview"
      className="min-w-0"
    />
  );
}
