"use client";

// Shared sub-navigation shown across a single job's pages. Summary / Info /
// Price Summary are live routes; the rest resolve to the [module] scaffold,
// which links out to existing features or shows "Coming soon."
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/dashboard/sidebar-context";

const TABS: { slug: string; label: string; href: (id: string) => string }[] = [
  { slug: "summary", label: "Summary", href: (id) => `/dashboard/jobs/${id}/summary` },
  { slug: "info", label: "Job Info", href: (id) => `/dashboard/jobs/${id}/info` },
  { slug: "price-summary", label: "Price Summary", href: (id) => `/dashboard/jobs/${id}/price-summary` },
  { slug: "client-portal", label: "Client Portal", href: (id) => `/dashboard/jobs/${id}/client-portal` },
  { slug: "schedule", label: "Schedule", href: (id) => `/dashboard/jobs/${id}/schedule` },
  { slug: "daily-logs", label: "Daily Logs", href: (id) => `/dashboard/jobs/${id}/daily-logs` },
  { slug: "punch-list", label: "Punch List", href: (id) => `/dashboard/jobs/${id}/punch-list` },
  { slug: "projects", label: "Projects & Tasks", href: (id) => `/dashboard/jobs/${id}/projects` },
  { slug: "documents", label: "Documents", href: (id) => `/dashboard/jobs/${id}/documents` },
  { slug: "files", label: "Files", href: (id) => `/dashboard/jobs/${id}/files` },
  { slug: "messages", label: "Messages", href: (id) => `/dashboard/jobs/${id}/messages` },
  { slug: "communications", label: "Communications", href: (id) => `/dashboard/jobs/${id}/communications` },
  { slug: "change-orders", label: "Change Orders", href: (id) => `/dashboard/jobs/${id}/change-orders` },
  { slug: "invoices", label: "Invoices", href: (id) => `/dashboard/jobs/${id}/invoices` },
  { slug: "selections", label: "Selections", href: (id) => `/dashboard/jobs/${id}/selections` },
  { slug: "warranty", label: "Warranty", href: (id) => `/dashboard/jobs/${id}/warranty` },
  { slug: "notes", label: "Notes", href: (id) => `/dashboard/jobs/${id}/notes` },
  { slug: "activity", label: "Activity", href: (id) => `/dashboard/jobs/${id}/activity` },
];

// Job header: back-to-all-jobs, the scrollable tab menu, and an optional
// action such as "Edit Job Info". One row on desktop. On phones and tablets
// the back link and action share the top row and the tabs get a full-width
// row of their own; squeezed between them, only a tab or two was visible.
export function JobDetailNav({ jobId, active, action }: { jobId: string; active: string; action?: React.ReactNode }) {
  const { collapsed } = useSidebar();

  // Bring the current tab into view: on a phone it's often off to the right.
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  const back = (
    <Link href="/dashboard/jobs" className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition hover:text-foreground">
      ← All jobs
    </Link>
  );

  // Horizontal bar — the default, and the mobile layout even when collapsed.
  const horizontal = (
    <div className="border-b border-border bg-card lg:flex lg:items-center lg:gap-3 lg:px-6">
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 md:px-6 lg:contents">
        {back}
        {action ? <div className="shrink-0 lg:order-last">{action}</div> : null}
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 md:px-4 lg:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            ref={active === t.slug ? activeRef : undefined}
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
    </div>
  );

  if (!collapsed) return horizontal;

  // Collapsed (job pages): a fixed vertical rail on desktop — out of document
  // flow so every page's content renders normally (the layout pads content left
  // to clear it). Mobile keeps the horizontal bar.
  return (
    <>
      <nav className="fixed bottom-0 left-[76px] top-14 z-30 hidden w-52 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-3 py-3">
          <Link href="/dashboard/jobs" className="text-sm text-muted-foreground transition hover:text-foreground">← All jobs</Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={t.href(jobId)}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition",
                active === t.slug ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {action ? <div className="border-t border-border p-2">{action}</div> : null}
      </nav>
      <div className="lg:hidden">{horizontal}</div>
    </>
  );
}
