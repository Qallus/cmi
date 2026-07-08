"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ClientJobNav({ jobId, tabs }: { jobId: string; tabs: { slug: string; label: string }[] }) {
  const pathname = usePathname();
  const base = `/client/jobs/${jobId}`;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const href = t.slug === "overview" ? base : `${base}/${t.slug}`;
        const active = t.slug === "overview" ? pathname === base : pathname === href;
        return (
          <Link key={t.slug} href={href}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition", active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
