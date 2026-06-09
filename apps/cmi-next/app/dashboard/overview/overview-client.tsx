"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarRange,
  Clock,
  FileText,
  FolderKanban,
  LayoutGrid,
  MessageCircle,
  Newspaper,
  Phone,
  Plus,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OverviewData } from "@/lib/overview/data";

type StatCard = {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
};

const QUICK_ACTIONS = [
  { label: "New Contact", href: "/dashboard/contacts", icon: Users },
  { label: "New Quote", href: "/dashboard/quotes-leads", icon: BriefcaseBusiness },
  { label: "New Booking", href: "/dashboard/bookings", icon: CalendarRange },
  { label: "New Blog Post", href: "/dashboard/blog", icon: Newspaper },
  { label: "New Document", href: "/dashboard/documents", icon: FileText },
  { label: "New Portfolio Item", href: "/dashboard/portfolio", icon: LayoutGrid },
];

const TYPE_BADGES: Record<string, "accent" | "success" | "warning" | "info" | "default"> = {
  Contact: "accent",
  Quote: "warning",
  Booking: "success",
  Document: "info",
  Blog: "default",
};

const LOCATION_ICONS: Record<string, React.ElementType> = {
  phone_call: Phone,
  video_meeting: Video,
  onsite: FolderKanban,
  in_person: Users,
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Phoenix",
  }).format(new Date(iso));
}

function StatCardItem({ card }: { card: StatCard }) {
  const Icon = card.icon;
  return (
    <Link href={card.href} className="block rounded-lg border border-border bg-card p-4 transition hover:border-accent/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{card.label}</div>
          <div className="mt-1.5 font-display text-3xl font-semibold tracking-tight">{card.value}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

export function OverviewClient({ data, demoMode }: { data: OverviewData; demoMode: boolean }) {
  const { stats, recent, upcoming } = data;

  const statCards: StatCard[] = [
    { label: "Contacts", value: stats.contacts, icon: Users, href: "/dashboard/contacts" },
    { label: "Projects", value: stats.projects, icon: FolderKanban, href: "/dashboard/project-manager" },
    { label: "Portfolio Items", value: stats.portfolio, icon: LayoutGrid, href: "/dashboard/portfolio" },
    { label: "Bookings", value: stats.bookings, icon: CalendarRange, href: "/dashboard/bookings" },
    { label: "Quotes", value: stats.quotes, icon: BriefcaseBusiness, href: "/dashboard/quotes-leads" },
    { label: "Leads", value: stats.leads, icon: BriefcaseBusiness, href: "/dashboard/quotes-leads" },
    { label: "Blog Posts", value: stats.blogPosts, icon: Newspaper, href: "/dashboard/blog" },
    { label: "Team Members", value: stats.teamMembers, icon: Users, href: "/dashboard/team" },
    { label: "Documents", value: stats.documents, icon: FileText, href: "/dashboard/documents" },
    { label: "Contracts", value: stats.contracts, icon: FileText, href: "/dashboard/documents" },
    { label: "SOWs", value: stats.sows, icon: FileText, href: "/dashboard/documents" },
    { label: "Active Staff", value: stats.activeStaff, icon: Users, href: "/dashboard/users" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dashboard</div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A snapshot of your business across all sections.
        </p>
      </div>

      {demoMode && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <strong>Demo mode.</strong> Add <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> to see live data.
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <StatCardItem key={card.label} card={card} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No recent activity yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={TYPE_BADGES[item.type] ?? "default"} className="shrink-0">
                          {item.type}
                        </Badge>
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{item.sub}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-accent/40 hover:bg-accent/5 hover:text-foreground"
                >
                  <Plus className="h-3 w-3 shrink-0" />
                  {label}
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming appointments */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Upcoming</CardTitle>
              <Link href="/dashboard/bookings" className="flex items-center gap-1 text-xs text-accent hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No upcoming appointments.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((appt) => {
                    const LocIcon = LOCATION_ICONS[appt.locationType] ?? CalendarRange;
                    return (
                      <li key={appt.id} className="px-5 py-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                            <LocIcon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{appt.title}</div>
                            <div className="text-xs text-muted-foreground">{appt.customerName}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(appt.startTime)}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
