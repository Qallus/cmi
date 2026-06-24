"use client";

import * as React from "react";
import { Mail, Phone, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessCardLead, LeadStatus } from "@/lib/business-cards/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "archived"];

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-accent/15 text-accent",
  contacted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  qualified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LeadsInbox({ isAdmin, scope }: { isAdmin: boolean; scope: "mine" | "all" }) {
  const [leads, setLeads] = React.useState<BusinessCardLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | LeadStatus>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-cards/leads${isAdmin && scope === "all" ? "?scope=all" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load leads.");
      setLeads(json.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope]);

  React.useEffect(() => { load(); }, [load]);

  async function setStatus(lead: BusinessCardLead, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status } : l));
    await fetch(`/api/business-cards/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => load());
  }

  async function remove(lead: BusinessCardLead) {
    if (!window.confirm("Delete this lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    await fetch(`/api/business-cards/leads/${lead.id}`, { method: "DELETE" }).catch(() => load());
  }

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUSES) c[s] = leads.filter((l) => l.status === s).length;
    return c;
  }, [leads]);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...STATUSES] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium capitalize transition", filter === f ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
              {f}
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading && !leads.length ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Mail className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">No leads yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">When someone taps “Send me your info” on a published card, their details land here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Card</th>
                {scope === "all" && <th className="px-4 py-3">Owner</th>}
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name || "—"}</div>
                    <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-accent"><Mail className="h-3 w-3" />{lead.email}</a>}
                      {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-accent"><Phone className="h-3 w-3" />{lead.phone}</a>}
                      {lead.company && <span>{lead.company}</span>}
                    </div>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-muted-foreground">{lead.message || "—"}</td>
                  <td className="px-4 py-3 text-xs">{lead.card?.display_name || lead.card?.card_name || "—"}</td>
                  {scope === "all" && <td className="px-4 py-3 text-xs text-muted-foreground">{lead.owner?.display_name || "—"}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{timeAgo(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => setStatus(lead, e.target.value as LeadStatus)}
                      className={cn("rounded-full border-0 px-2 py-1 text-[11px] font-medium capitalize outline-none", STATUS_STYLE[lead.status])}
                    >
                      {STATUSES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(lead)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
