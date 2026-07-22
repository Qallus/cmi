"use client";

import * as React from "react";
import Link from "next/link";

/**
 * A footer link that only renders when its feature flag is on, mirroring how
 * SiteHeader gates the same entries. Without this, toggling a flag off would
 * hide the item in the nav but leave a 404 link in the footer of every page.
 */
export function FooterFlagLink({ flag, href, label }: { flag: string; href: string; label: string }) {
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
      <Link href={href} className="text-sm text-white/60 transition hover:text-white">{label}</Link>
    </li>
  );
}
