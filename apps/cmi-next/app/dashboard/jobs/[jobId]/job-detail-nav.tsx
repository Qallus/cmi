"use client";

// Shared sub-navigation shown across a single job's pages. Summary / Info /
// Price Summary are live routes; the rest resolve to the [module] scaffold,
// which links out to existing features or shows "Coming soon."
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BadgeDollarSign, CalendarRange, Camera, Circle, ClipboardList, FileSignature, FileText, FolderOpen, Info, LayoutDashboard,
  Layers, ListChecks, MessageSquare, MessagesSquare, NotebookPen, PanelLeftClose, PanelLeftOpen, Phone, Receipt, ShieldCheck, Sparkles, SquareKanban, UserRound,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { ShortScroll } from "@/components/ui/short-scroll";
import { SidePanel } from "@/components/ui/side-panel";
import { ClientFeedList } from "@/components/jobs/client-feed-list";
import { useSidebar } from "@/components/dashboard/sidebar-context";
import { ExecSummaryDialog } from "@/components/exec-summary/exec-summary-button";

const TABS: { slug: string; label: string; href: (id: string) => string; flag?: string }[] = [
  { slug: "summary", label: "Summary", href: (id) => `/dashboard/jobs/${id}/summary` },
  { slug: "info", label: "Job Info", href: (id) => `/dashboard/jobs/${id}/info` },
  { slug: "price-summary", label: "Price Summary", href: (id) => `/dashboard/jobs/${id}/price-summary` },
  { slug: "client-portal", label: "Client Portal", href: (id) => `/dashboard/jobs/${id}/client-portal` },
  { slug: "schedule", label: "Schedule", href: (id) => `/dashboard/jobs/${id}/schedule` },
  { slug: "daily-logs", label: "Daily Logs", href: (id) => `/dashboard/jobs/${id}/daily-logs` },
  { slug: "photos", label: "Photos", href: (id) => `/dashboard/jobs/${id}/photos`, flag: "field_reports" },
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
  { slug: "activity", label: "Client Activity", href: (id) => `/dashboard/jobs/${id}/activity` },
];

// Icons for the folded (rail) job menu, and beside each label when it's open.
const TAB_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  summary: LayoutDashboard, info: Info, "price-summary": BadgeDollarSign, "client-portal": UserRound, schedule: CalendarRange,
  "daily-logs": NotebookPen, photos: Camera, "punch-list": ListChecks, projects: SquareKanban, documents: FileText, files: FolderOpen,
  messages: MessageSquare, communications: Phone, "change-orders": FileSignature, invoices: Receipt, selections: Layers,
  warranty: ShieldCheck, notes: ClipboardList, activity: MessagesSquare,
};

// Job header: back-to-all-jobs and the job's menu, ending with Executive
// Summary (opens as a slide-out). Page actions such as "Add Invoice" live in
// each page's title row, not here, so they never cover the menu.
export function JobDetailNav({ jobId, active }: { jobId: string; active: string }) {
  const { collapsed, jobNavCollapsed, setJobNavCollapsed } = useSidebar();
  const rail = collapsed && jobNavCollapsed;
  const [summaryFor, setSummaryFor] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState(false);
  // Tabs behind a feature flag (Photos = Field Reports) show once it's on.
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    fetch("/api/flags").then((r) => r.json()).then((d: { flags?: Record<string, boolean> }) => setFlags(d.flags ?? {})).catch(() => {});
  }, []);
  const tabs = TABS.filter((t) => !t.flag || flags[t.flag]);

  // What the client sent that's still waiting on the team (lib/jobs/client-feed.ts):
  // badges on the tabs it lives in, and the floating Client activity button.
  const [waiting, setWaiting] = React.useState<{ open: number; openBy: Record<string, number> }>({ open: 0, openBy: {} });
  const [feedOpen, setFeedOpen] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    const load = () => fetch(`/api/jobs/${jobId}/client-feed?summary=1`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setWaiting({ open: d.open ?? 0, openBy: d.openBy ?? {} }); }).catch(() => {});
    void load();
    const t = window.setInterval(load, 120_000);
    return () => { live = false; window.clearInterval(t); };
  }, [jobId]);
  const badge = (slug: string): number => {
    const b = waiting.openBy;
    if (slug === "selections") return b.selection ?? 0;
    if (slug === "messages") return b.message ?? 0;
    if (slug === "communications") return (b.sms ?? 0) + (b.email ?? 0);
    if (slug === "activity") return waiting.open;
    return 0;
  };
  const Count = ({ n }: { n: number }) => (n > 0 ? <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{n > 9 ? "9+" : n}</span> : null);
  const feedFab = (
    <>
      <button type="button" onClick={() => setFeedOpen(true)} title="Everything the client sent on this job"
        className={cn("fixed bottom-[5.5rem] right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg transition print:hidden lg:bottom-6 lg:right-24",
          waiting.open ? "border-accent bg-accent text-accent-foreground hover:opacity-90" : "border-border bg-card text-foreground hover:border-accent")}>
        <MessagesSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Client activity</span>
        {waiting.open > 0 && <span className="rounded-full bg-background/25 px-1.5 text-xs">{waiting.open} new</span>}
      </button>
      {feedOpen && (
        <SidePanel title="Client activity" subtitle="Everything the client sent on this job, newest first" onClose={() => setFeedOpen(false)}>
          <ClientFeedList jobId={jobId} onNavigate={() => setFeedOpen(false)} onLoaded={(open) => setWaiting((w) => ({ ...w, open }))} />
        </SidePanel>
      )}
    </>
  );

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
        {tabs.map((t) => (
          <Link
            key={t.slug}
            ref={active === t.slug ? activeRef : undefined}
            href={t.href(jobId)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active === t.slug ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}<Count n={badge(t.slug)} />
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

  if (!collapsed) return <>{horizontal}{summaryDialog}{feedFab}</>;

  // Collapsed (job pages): a fixed vertical rail on desktop — out of document
  // flow so every page's content renders normally (the layout pads content left
  // to clear it). Mobile keeps the horizontal bar.
  return (
    <>
      <nav className={cn("fixed bottom-0 left-[76px] top-14 z-30 hidden flex-col border-r border-border bg-card transition-[width] lg:flex", rail ? "w-14" : "w-52")}>
        <div className={cn("border-b border-border py-3", rail ? "flex justify-center px-1" : "px-3")}>
          {rail
            ? <Tooltip label="All jobs" side="right" className="inline-block"><Link href="/dashboard/jobs" aria-label="All jobs" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link></Tooltip>
            : <Link href="/dashboard/jobs" className="text-sm text-muted-foreground transition hover:text-foreground">← All jobs</Link>}
        </div>
        <ShortScroll className="flex-1" innerClassName={rail ? "space-y-0.5 px-1.5 py-2" : "p-2 pr-3"}>
          {tabs.map((t) => {
            const Icon = TAB_ICON[t.slug] ?? Circle;
            const n = badge(t.slug);
            const on = active === t.slug;
            return rail ? (
              <Tooltip key={t.slug} label={n ? `${t.label} (${n} new)` : t.label} side="right" className="block">
                <Link href={t.href(jobId)} aria-label={t.label} aria-current={on ? "page" : undefined}
                  className={cn("relative flex h-9 w-full items-center justify-center rounded-md transition", on ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icon className="h-4 w-4" />
                  {n > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" /> : null}
                </Link>
              </Tooltip>
            ) : (
              <Link key={t.slug} href={t.href(jobId)} aria-current={on ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition", on ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{t.label}</span><Count n={n} />
              </Link>
            );
          })}
          {rail ? (
            <Tooltip label="Executive Summary" side="right" className="block">
              <button type="button" onClick={() => void openSummary()} aria-label="Executive Summary" className="mt-1 flex h-9 w-full items-center justify-center rounded-md text-accent transition hover:bg-muted"><Sparkles className="h-4 w-4" /></button>
            </Tooltip>
          ) : (
            <button type="button" onClick={() => void openSummary()}
              className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Sparkles className="h-4 w-4 text-accent" /> Executive Summary
            </button>
          )}
        </ShortScroll>
        {/* Fold the job menu into icons, like the main sidebar. */}
        <div className={cn("border-t border-border p-2", rail ? "flex justify-center" : "flex justify-end")}>
          <Tooltip label={rail ? "Expand job menu" : "Collapse job menu"} side="right" className="inline-block">
            <button type="button" onClick={() => setJobNavCollapsed(!rail)} aria-label={rail ? "Expand job menu" : "Collapse job menu"}
              className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-foreground">
              {rail ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>
        </div>
      </nav>
      <div className="lg:hidden">{horizontal}</div>
      {summaryDialog}
      {feedFab}
    </>
  );
}
