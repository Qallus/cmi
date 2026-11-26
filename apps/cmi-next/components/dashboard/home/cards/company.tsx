"use client";

// The original Overview, as cards: company counts (one sliding row), recent
// activity, quick actions and the admin Revenue Outlook.
import Link from "next/link";
import { BriefcaseBusiness, CalendarRange, FileText, FolderKanban, LayoutGrid, Newspaper, Users } from "lucide-react";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";
import { ago, Empty, Frame, Unavailable } from "../kit";
import { SlideRow } from "../slide-row";

export function CompanyCountsCard({ data }: { data: DashboardData }) {
  const o = data.overview;
  if (!o) return <Unavailable title="Company counts" icon={CARDS.company_counts.icon} />;
  const s = o.stats;
  const cards = [
    { label: "Contacts", value: s.contacts, icon: Users, href: "/dashboard/contacts" },
    { label: "Projects", value: s.projects, icon: FolderKanban, href: "/dashboard/project-manager" },
    { label: "Portfolio items", value: s.portfolio, icon: LayoutGrid, href: "/dashboard/portfolio" },
    { label: "Bookings", value: s.bookings, icon: CalendarRange, href: "/dashboard/bookings" },
    { label: "Quotes", value: s.quotes, icon: BriefcaseBusiness, href: "/dashboard/quotes-leads" },
    { label: "Leads", value: s.leads, icon: BriefcaseBusiness, href: "/dashboard/contacts?tab=Lead" },
    { label: "Blog posts", value: s.blogPosts, icon: Newspaper, href: "/dashboard/blog" },
    { label: "Team members", value: s.teamMembers, icon: Users, href: "/dashboard/team" },
    { label: "Documents", value: s.documents, icon: FileText, href: "/dashboard/documents" },
    { label: "Contracts", value: s.contracts, icon: FileText, href: "/dashboard/documents" },
    { label: "SOWs", value: s.sows, icon: FileText, href: "/dashboard/documents" },
    { label: "Active staff", value: s.activeStaff, icon: Users, href: "/dashboard/users" },
  ];
  return (
    <SlideRow label="Company counts">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="flex w-[10.5rem] shrink-0 snap-start items-start justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-accent/40">
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{c.label}</span>
            <span className="mt-1.5 block text-2xl font-semibold tracking-tight tabular-nums">{c.value.toLocaleString()}</span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><c.icon className="size-4" /></span>
        </Link>
      ))}
    </SlideRow>
  );
}

const TYPE_TONE: Record<string, string> = {
  Contact: "bg-accent/15 text-accent", Quote: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Booking: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", Document: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

export function RecentActivityCard({ data }: { data: DashboardData }) {
  const meta = CARDS.recent_activity;
  const o = data.overview;
  if (!o) return <Unavailable title={meta.title} icon={meta.icon} />;
  return (
    <Frame title={meta.title} icon={meta.icon}>
      {!o.recent.length ? <Empty>No recent activity.</Empty> : (
        <ul className="divide-y divide-border">
          {o.recent.slice(0, 8).map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex items-center gap-3 py-2 text-sm">
              <span className={cn("w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium", TYPE_TONE[r.type] ?? "bg-muted text-muted-foreground")}>{r.type}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.label}</span>{r.sub ? <span className="block truncate text-xs text-muted-foreground">{r.sub}</span> : null}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{ago(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

const QUICK_ACTIONS = [
  { label: "New contact", href: "/dashboard/contacts", icon: Users },
  { label: "New quote", href: "/dashboard/quotes-leads", icon: BriefcaseBusiness },
  { label: "New booking", href: "/dashboard/bookings", icon: CalendarRange },
  { label: "New blog post", href: "/dashboard/blog", icon: Newspaper },
  { label: "New document", href: "/dashboard/documents", icon: FileText },
  { label: "New portfolio item", href: "/dashboard/portfolio", icon: LayoutGrid },
];

export function QuickActionsCard() {
  const meta = CARDS.quick_actions;
  return (
    <Frame title={meta.title} icon={meta.icon}>
      <div className="grid gap-1.5">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
            <a.icon className="size-4 text-accent" /> {a.label}
          </Link>
        ))}
      </div>
    </Frame>
  );
}

/** Server-rendered Revenue Outlook (admins, Projections on), passed in as a slot. */
export function RevenueOutlookSlot({ slot }: { slot?: React.ReactNode }) {
  if (!slot) return <Unavailable title="Revenue outlook" icon={CARDS.revenue_outlook.icon} />;
  return <div className="h-full [&>*]:h-full">{slot}</div>;
}
