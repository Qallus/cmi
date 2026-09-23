import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, ArrowLeft } from "lucide-react";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseReporting, REPORTING_FLAG } from "@/lib/reporting/access";

export const metadata = { title: "Analytics — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Placeholder while the marketing integrations are built. Listed in the nav so
// the section is visible, but it makes no claim to have data yet.
const SOURCES = [
  { name: "Google Analytics 4", detail: "Sessions, traffic sources and conversions for constructedmatter.com." },
  { name: "Google Search Console", detail: "Search impressions, clicks and the queries bringing people in." },
  { name: "Google Ads", detail: "Spend, clicks and cost per lead, matched back to Pipeline deals." },
  { name: "Meta / Instagram", detail: "Reach and engagement on the work we post." },
  { name: "LinkedIn", detail: "Company page followers and post performance." },
];

export default async function AnalyticsPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseReporting(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(REPORTING_FLAG))) notFound();

  return (
    <div className="space-y-5">
      <Link href="/dashboard/reporting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to reporting
      </Link>

      <header>
        <h1 className="font-serif text-2xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Marketing and search performance, alongside the work it brings in.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Not connected yet</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
          Nothing here is live. Each source below needs its account connected before it can report anything —
          that work hasn&apos;t started.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <li key={source.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{source.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Not connected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{source.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
