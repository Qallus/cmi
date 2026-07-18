"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import * as api from "./canvas-api";
import type { CanvasProject } from "@/lib/canvas/types";

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-[#c87f3a]/15 text-[#c87f3a]",
  in_review: "bg-info/15 text-info",
  responded: "bg-[#2e7d5b]/15 text-[#2e7d5b]",
};
const STATUS_LABEL: Record<string, string> = { submitted: "Submitted", in_review: "In review", responded: "Responded" };

export function BriefList() {
  const [briefs, setBriefs] = React.useState<CanvasProject[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.apiListCanvases().then((all) => setBriefs(all.filter((c) => c.status !== "draft"))).catch((e) => setError(e instanceof Error ? e.message : "Could not load briefs."));
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Project Canvas</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Canvas Briefs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Project briefs clients have submitted through Project Canvas.</p>
      </div>

      {error && <div className="mb-4 text-sm text-destructive">{error}</div>}

      {briefs === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <Inbox className="h-6 w-6" /> No submitted briefs yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((c) => (
            <Link key={c.id} href={`/dashboard/canvas-briefs/${c.id}`} className="rounded-xl border border-border bg-card p-4 transition hover:border-accent/50">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[c.status] ?? "bg-muted text-muted-foreground"}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(c.submitted_at ?? c.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-2 font-medium">{c.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
