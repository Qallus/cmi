"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type Req = { id: string; request_title: string; status: string; category: string | null; location_in_home: string | null; priority: string | null; submitted_at: string; request_description: string | null; resolution_notes: string | null };

const CATEGORIES = ["Plumbing", "Electrical", "HVAC", "Drywall", "Paint", "Flooring", "Cabinets", "Doors / Windows", "Appliance", "Exterior", "Landscape", "Other"];
const STATUS_TONE: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  submitted: "info", under_review: "warning", scheduled: "warning", in_progress: "warning", resolved: "success", closed: "default",
};
const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

function fmt(iso: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)); }

export function ClientWarranty({ jobId, initial, canSubmit }: { jobId: string; initial: Req[]; canSubmit: boolean }) {
  const [reqs, setReqs] = React.useState<Req[]>(initial);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ request_title: "", request_description: "", category: CATEGORIES[0], location_in_home: "", priority: "normal" });

  async function submit() {
    if (!f.request_title.trim()) { setError("Please add a title."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/warranty`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setReqs((r) => [j, ...r]); setOpen(false);
      setF({ request_title: "", request_description: "", category: CATEGORIES[0], location_in_home: "", priority: "normal" });
    } catch (e) { setError(e instanceof Error ? e.message : "Submit failed."); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Submit and track warranty requests for your completed project.</p>
        {canSubmit && <Button size="sm" variant="accent" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> New Request</Button>}
      </div>

      {reqs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No warranty requests yet.</div>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-medium">{r.request_title}</span><Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status.replace(/_/g, " ")}</Badge></div>
                <span className="text-xs text-muted-foreground">{fmt(r.submitted_at)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{[r.category, r.location_in_home].filter(Boolean).join(" · ")}</div>
              {r.request_description && <p className="mt-2 text-sm text-muted-foreground">{r.request_description}</p>}
              {r.resolution_notes && <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm"><span className="font-medium">Update from CMI:</span> {r.resolution_notes}</p>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 className="mb-3 font-semibold">New Warranty Request</h2>
            {error && <div className="mb-3 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-3">
              <input className={inputCls} placeholder="Title (e.g. Kitchen faucet drip)" value={f.request_title} onChange={(e) => setF({ ...f, request_title: e.target.value })} />
              <textarea className={`${inputCls} h-24 py-2`} placeholder="Describe the issue" value={f.request_description} onChange={(e) => setF({ ...f, request_description: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
                <input className={inputCls} placeholder="Location in home" value={f.location_in_home} onChange={(e) => setF({ ...f, location_in_home: e.target.value })} />
                <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option></Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
