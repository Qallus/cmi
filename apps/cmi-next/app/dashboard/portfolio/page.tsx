import { AlertTriangle } from "lucide-react";
import { loadPortfolioItems } from "@/lib/portfolio/data";
import { demoPortfolioItems } from "@/lib/portfolio/demo-data";
import { PortfolioClient } from "./portfolio-client";

export default async function PortfolioDashboardPage() {
  try {
    const items = await loadPortfolioItems();
    return <PortfolioClient initialItems={items} demoMode={false} />;
  } catch (error) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <div className="font-semibold">Portfolio is ready for configuration</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Run <code>supabase/2026-05-29_portfolio_dashboard_fields.sql</code> and confirm Supabase server credentials are configured.
              </p>
              <pre className="mt-3 max-w-2xl overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">{error instanceof Error ? error.message : "Portfolio load failed."}</pre>
            </div>
          </div>
        </div>
        <PortfolioClient initialItems={demoPortfolioItems} demoMode />
      </div>
    );
  }
}
