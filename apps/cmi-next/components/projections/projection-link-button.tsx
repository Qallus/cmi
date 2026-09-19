"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// "Add to Projections" / "In Projections" for a deal or Pre-Con opportunity.
// Renders nothing unless the viewer can use Projections: the link API is
// admin + flag gated and answers 403/404 otherwise.
export function ProjectionLinkButton({ kind, id, className }: { kind: "deal" | "opportunity"; id: string; className?: string }) {
  const [state, setState] = React.useState<{ ready: boolean; projectionId: string | null }>({ ready: false, projectionId: null });

  React.useEffect(() => {
    let alive = true;
    fetch(`/api/projections/link?${kind === "deal" ? "deal_id" : "opportunity_id"}=${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { projection_id: string | null }) : null))
      .then((j) => { if (alive && j) setState({ ready: true, projectionId: j.projection_id }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [kind, id]);

  if (!state.ready) return null;
  const base = "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition";
  return state.projectionId ? (
    <Link href={`/dashboard/projections?open=${state.projectionId}`} className={cn(base, "border-success/40 bg-success/10 text-success hover:bg-success/15", className)}>
      <TrendingUp className="h-3.5 w-3.5" /> In Projections
    </Link>
  ) : (
    <Link href={`/dashboard/projections?${kind === "deal" ? "add_deal" : "add_opportunity"}=${id}`} className={cn(base, "border-border hover:bg-muted", className)}>
      <TrendingUp className="h-3.5 w-3.5" /> Add to Projections
    </Link>
  );
}
