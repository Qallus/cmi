import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { monthLabel } from "@/lib/projections/calc";
import type { Outlook } from "@/lib/projections/data";

// Admin-only: next 3 months projected vs actual, and the backlog. Rendered only
// when the server loaded an outlook (see overview/page.tsx).
export function RevenueOutlookCard({ outlook }: { outlook: Outlook }) {
  const { summary } = outlook;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Revenue Outlook</CardTitle>
        <Link href="/dashboard/projections" className="flex items-center gap-1 text-xs text-accent hover:underline">Projections <ArrowRight className="h-3 w-3" /></Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {outlook.projects === 0 ? (
          <p className="text-sm text-muted-foreground">No projects in Projections yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {outlook.next3.map((m) => (
                <div key={m.month} className="rounded-md border border-border px-2 py-2 text-center">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{monthLabel(m.month)}</div>
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(m.projected, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">{outlook.anyActuals ? `act ${formatMoney(m.actual, { compact: true })}` : "projected"}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">12-month projected</span><span className="font-medium tabular-nums">{formatMoney(summary.projected12)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining backlog</span><span className="font-medium tabular-nums">{formatMoney(summary.remainingBacklog)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Contracted · potential</span><span className="tabular-nums">{formatMoney(summary.contractedBacklog, { compact: true })} · {formatMoney(summary.potentialBacklog, { compact: true })}</span></div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
