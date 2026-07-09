"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionItem } from "@/lib/action-items/types";
import { fmtDate } from "../../../portal-ui";

const PRIORITY_TONE: Record<string, "default" | "info" | "warning" | "danger"> = { low: "default", normal: "info", high: "warning", urgent: "danger" };

export function ActionItemsClient({ jobId, initial }: { jobId: string; initial: ActionItem[] }) {
  const [rows, setRows] = React.useState<ActionItem[]>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function complete(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/action-items/${id}/complete`, { method: "POST" });
      const j = await res.json(); if (res.ok) setRows((r) => r.map((x) => (x.id === id ? j : x)));
    } finally { setBusy(null); }
  }

  const open = rows.filter((r) => r.status === "open" || r.status === "in_progress");
  const done = rows.filter((r) => r.status === "completed" || r.status === "dismissed");

  if (rows.length === 0) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">You have no action items right now. 🎉</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {open.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className="font-medium">{a.title}</span><Badge tone={PRIORITY_TONE[a.priority] ?? "default"}>{a.priority}</Badge></div>
                {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                {a.due_date && <div className="mt-1 text-xs text-muted-foreground">Due {fmtDate(a.due_date)}</div>}
              </div>
              <Button size="sm" variant="accent" disabled={busy === a.id} onClick={() => void complete(a.id)}><Check className="h-3.5 w-3.5" /> Mark done</Button>
            </div>
          </div>
        ))}
        {open.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing needs your attention right now.</div>}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Completed</h2>
          <div className="space-y-2">
            {done.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
                <span className="line-through">{a.title}</span>
                <span className="text-xs">{a.completed_at ? fmtDate(a.completed_at) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
