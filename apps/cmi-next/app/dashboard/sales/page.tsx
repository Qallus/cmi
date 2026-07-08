import { loadQuotes } from "@/lib/quotes/data";
import type { Quote } from "@/lib/quotes/types";
import { loadOpportunities, loadStageHistory } from "@/lib/pipeline/data";
import { computeReport } from "@/lib/pipeline/reporting";
import type { Opportunity, StageHistoryRow } from "@/lib/pipeline/types";
import { SalesClient } from "./sales-client";

export const metadata = { title: "Sales — CMI Dashboard" };

export const dynamic = "force-dynamic";

// Unified Sales hub — one destination for the whole funnel:
//   Leads (quotes) → Opportunities (pipeline) → Reports.
export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === "opportunities" || tab === "reports" ? tab : "leads";
  let quotes: Quote[] = [];
  let opportunities: Opportunity[] = [];
  let history: StageHistoryRow[] = [];
  try {
    [quotes, opportunities, history] = await Promise.all([
      loadQuotes(),
      loadOpportunities(),
      loadStageHistory(),
    ]);
  } catch {
    // Fall back to empty datasets if anything is unreachable.
  }
  const report = computeReport(opportunities, history, quotes.length);
  return (
    <SalesClient
      initialTab={initialTab}
      initialQuotes={quotes}
      initialOpportunities={opportunities}
      initialReport={report}
    />
  );
}
