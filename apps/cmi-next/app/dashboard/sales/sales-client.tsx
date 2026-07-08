"use client";

import * as React from "react";
import { BriefcaseBusiness, PieChart, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuotesClient } from "../quotes-leads/quotes-client";
import { PipelineClient } from "../pipeline/pipeline-client";
import { SalesReports } from "./sales-reports";
import type { Quote } from "@/lib/quotes/types";
import type { Opportunity } from "@/lib/pipeline/types";
import type { PipelineReport } from "@/lib/pipeline/reporting";

type SalesTab = "leads" | "opportunities" | "reports";

const TABS: { key: SalesTab; label: string; icon: typeof Workflow; hint: string }[] = [
  { key: "leads", label: "Leads", icon: BriefcaseBusiness, hint: "Marketing & intake — quote requests and CRM leads (no job number yet)." },
  { key: "opportunities", label: "Opportunities", icon: Workflow, hint: "Real projects with a job number, moving through the build lifecycle." },
  { key: "reports", label: "Reports", icon: PieChart, hint: "Conversion, forecast, and loss reporting across the whole funnel." },
];

export function SalesClient({
  initialTab,
  initialQuotes,
  initialOpportunities,
  initialReport,
}: {
  initialTab: SalesTab;
  initialQuotes: Quote[];
  initialOpportunities: Opportunity[];
  initialReport: PipelineReport;
}) {
  const [tab, setTab] = React.useState<SalesTab>(initialTab);

  // Keep the URL in sync (deep-links / refresh / old-route redirects land on the
  // right tab) without triggering a navigation + data reload.
  function switchTab(next: SalesTab) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard/sales?tab=${next}`);
    }
  }

  const activeHint = TABS.find((t) => t.key === tab)?.hint;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Tab bar — the single 'Sales' hub's sub-navigation */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-border bg-card px-4 pt-2 md:px-6">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
                tab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        {activeHint && <div className="pb-1.5 pt-2 text-xs text-muted-foreground">{activeHint}</div>}
      </div>

      {/* Active tab content. Each workspace fills the remaining height. */}
      <div className="min-h-0 flex-1">
        {tab === "leads" && <QuotesClient initialQuotes={initialQuotes} />}
        {tab === "opportunities" && <PipelineClient initialOpportunities={initialOpportunities} initialReport={initialReport} />}
        {tab === "reports" && <SalesReports report={initialReport} quotes={initialQuotes} />}
      </div>
    </div>
  );
}
