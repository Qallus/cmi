"use client";

// Shared sub-navigation shown across a single job's pages. Summary / Info /
// Price Summary are live routes; the rest resolve to the [module] scaffold,
// which links out to existing features or shows "Coming soon."
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useSidebar } from "@/components/dashboard/sidebar-context";
import { ExecSummaryDialog } from "@/components/exec-summary/exec-summary-button";

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

// Job header: back-to-all-jobs and the job's menu, ending with Executive
// Summary (opens as a slide-out). Page actions such as "Add Invoice" live in
// each page's title row, not here, so they never cover the menu.
export function JobDetailNav({ jobId, active }: { jobId: string; active: string }) {
  const { collapsed } = useSidebar();
  const [summaryFor, setSummaryFor] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState(false);

  // The summary needs the job's name (it is printed on the document).
  async function openSummary() {
    if (opening) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const job = res.ok ? ((await res.json()) as { job_name?: string | null }) : null;
      setSummaryFor(job?.job_name || "This job");
    } finally { setOpening(false); }
  }
  const summaryDialog = summaryFor !== null && (
    <ExecSummaryDialog target="job" id={jobId} name={summaryFor} asPanel onClose={() => setSummaryFor(null)} />
  );

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
        <button
          type="button"
          onClick={() => void openSummary()}
          className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Executive Summary
        </button>
      </div>
    </div>
  );

  if (!collapsed) return <>{horizontal}{summaryDialog}</>;

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
          <button
            type="button"
            onClick={() => void openSummary()}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Executive Summary
          </button>
        </div>
      </nav>
      <div className="lg:hidden">{horizontal}</div>
      {summaryDialog}
    </>
  );
}
