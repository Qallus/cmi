"use client";

// Shared sub-navigation shown across a single job's pages. Summary / Info /
// Price Summary are live routes; the rest resolve to the [module] scaffold,
// which links out to existing features or shows "Coming soon."
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS: { slug: string; label: string; href: (id: string) => string }[] = [
  { slug: "summary", label: "Summary", href: (id) => `/dashboard/jobs/${id}/summary` },
  { slug: "info", label: "Job Info", href: (id) => `/dashboard/jobs/${id}/info` },
  { slug: "price-summary", label: "Price Summary", href: (id) => `/dashboard/jobs/${id}/price-summary` },
  { slug: "client-portal", label: "Client Portal", href: (id) => `/dashboard/jobs/${id}/client-portal` },
  { slug: "schedule", label: "Schedule", href: (id) => `/dashboard/jobs/${id}/schedule` },
  { slug: "files", label: "Files", href: (id) => `/dashboard/jobs/${id}/files` },
  { slug: "messages", label: "Messages", href: (id) => `/dashboard/jobs/${id}/messages` },
  { slug: "change-orders", label: "Change Orders", href: (id) => `/dashboard/jobs/${id}/change-orders` },
  { slug: "invoices", label: "Invoices", href: (id) => `/dashboard/jobs/${id}/invoices` },
  { slug: "selections", label: "Selections", href: (id) => `/dashboard/jobs/${id}/selections` },
  { slug: "warranty", label: "Warranty", href: (id) => `/dashboard/jobs/${id}/warranty` },
  { slug: "notes", label: "Notes", href: (id) => `/dashboard/jobs/${id}/notes` },
  { slug: "activity", label: "Activity", href: (id) => `/dashboard/jobs/${id}/activity` },
];

// Single-row job header: back-to-all-jobs (left), the scrollable tab menu
// (center), and an optional action such as "Edit Job Info" (right).
export function JobDetailNav({ jobId, active, action }: { jobId: string; active: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Link href="/dashboard/jobs" className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition hover:text-foreground">
        ← All jobs
      </Link>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={t.href(jobId)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active === t.slug ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
