"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A footer link that only renders when its feature flag is on, mirroring how
 * SiteHeader gates the same entries. Without this, toggling a flag off would
 * hide the item in the nav but leave a 404 link in the footer of every page.
 *
 * `icon` and `className` exist because the two footer columns are styled
 * differently — Company is plain text, Get in Touch is an icon beside each
 * row — and one component serving both beats two that drift apart.
 *
 * `icon` takes a rendered element, not a component. SiteFooter is a server
 * component and this is a client one, so a component reference cannot cross
 * the boundary ("Functions cannot be passed directly to Client Components");
 * an element can.
 */
export function FooterFlagLink({
  flag, href, label, icon, className,
}: {
  flag: string;
  href: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/flags")
      .then((r) => r.json())
      .then((d: { flags?: Record<string, boolean> }) => setEnabled(d.flags?.[flag] === true))
      .catch(() => {});
  }, [flag]);

  if (!enabled) return null;

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "text-sm text-white/60 transition hover:text-white",
          icon && "flex items-start gap-2.5",
          className,
        )}
      >
        {icon}
        {label}
      </Link>
    </li>
  );
}
