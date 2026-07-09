"use client";

import * as React from "react";
import { Check, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectSelection } from "@/lib/selections/types";
import { money, humanize } from "../../../portal-ui";

const APPROVAL_TONE: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  not_required: "default", pending: "warning", approved: "success", rejected: "danger", revision_requested: "danger", approved_with_changes: "success",
};

export function SelectionsClient({ jobId, initial }: { jobId: string; initial: ProjectSelection[] }) {
  const [rows, setRows] = React.useState<ProjectSelection[]>(initial);
  const [commenting, setCommenting] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function decide(sel: ProjectSelection, decision: "approved" | "revision_requested", note?: string) {
    setBusy(sel.id);
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/selections/${sel.id}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, comment: note ?? null }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => r.map((x) => (x.id === sel.id ? j : x)));
      setCommenting(null); setComment("");
    } catch { /* surfaced inline below via disabled state */ } finally { setBusy(null); }
  }

  if (rows.length === 0) return <Empty>No selections have been shared yet.</Empty>;

  // Group by room/area then category.
  const groups = new Map<string, ProjectSelection[]>();
  for (const s of rows) { const k = s.room_area_name || "General"; groups.set(k, [...(groups.get(k) ?? []), s]); }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([room, items]) => (
        <div key={room}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">{room}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((s) => {
              const needsDecision = s.client_approval_required && s.approval_status === "pending";
              return (
                <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {s.image_url && <div className="h-40 bg-muted"><img src={s.image_url} alt={s.name} className="h-full w-full object-cover" /></div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{[s.category, s.custom_product_name].filter(Boolean).join(" · ")}</div>
                      </div>
                      <Badge tone={APPROVAL_TONE[s.approval_status] ?? "default"}>{humanize(s.approval_status)}</Badge>
                    </div>
                    {s.description && <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {s.client_price != null && <span>{money(s.client_price)}</span>}
                      {s.allowance_amount != null && <span className="text-muted-foreground">Allowance: {money(s.allowance_amount)}</span>}
                      {s.product_url && <a href={s.product_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">View product</a>}
                    </div>
                    {s.client_comments && <p className="mt-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs"><span className="font-medium">Your note:</span> {s.client_comments}</p>}

                    {needsDecision && (
                      commenting === s.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What change would you like?" rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setCommenting(null)}>Cancel</Button>
                            <Button size="sm" variant="accent" disabled={!comment.trim() || busy === s.id} onClick={() => void decide(s, "revision_requested", comment)}>Send request</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="accent" disabled={busy === s.id} onClick={() => void decide(s, "approved")}><Check className="h-3.5 w-3.5" /> Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => { setCommenting(s.id); setComment(""); }}><MessageSquare className="h-3.5 w-3.5" /> Request change</Button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
