"use client";

import * as React from "react";
import { Check, ExternalLink, Loader2, Mail, Phone, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessCardLead, LeadStatus } from "@/lib/business-cards/types";

type ConvertTarget = "contact" | "user" | "quote" | "project" | "document";
const TARGETS: [ConvertTarget, string][] = [
  ["contact", "Contact"], ["user", "User"], ["quote", "Quote / Lead"],
  ["project", "Project"], ["document", "Document (Contract / SOW)"],
];
const CONTACT_TYPES = ["Client", "Lead", "Prospect", "Customer", "Vendor", "Sub Contractor", "Designer", "Other"];
const ROLES = ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "subcontractor", "vendor", "client", "viewer"];
const DOC_TYPES: [string, string][] = [["contract", "Contract"], ["sow", "SOW"], ["proposal", "Proposal"], ["change_order", "Change Order"], ["other", "Other"]];

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

export function LeadsInbox({ isAdmin, scope, onChanged }: { isAdmin: boolean; scope: "mine" | "all"; onChanged?: () => void }) {
  const [leads, setLeads] = React.useState<BusinessCardLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | LeadStatus>("all");
  const [convertLead, setConvertLead] = React.useState<BusinessCardLead | null>(null);

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
    onChanged?.();
  }

  async function remove(lead: BusinessCardLead) {
    if (!window.confirm("Delete this lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    await fetch(`/api/business-cards/leads/${lead.id}`, { method: "DELETE" }).catch(() => load());
    onChanged?.();
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
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setConvertLead(lead)} title="Save to…" className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-accent">
                        <UserPlus className="h-3.5 w-3.5" />Save to…
                      </button>
                      <button onClick={() => remove(lead)} title="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={() => { onChanged?.(); }}
        />
      )}
    </div>
  );
}

function ConvertLeadModal({ lead, onClose, onConverted }: { lead: BusinessCardLead; onClose: () => void; onConverted: () => void }) {
  const [target, setTarget] = React.useState<ConvertTarget>("contact");
  const [contactType, setContactType] = React.useState("Lead");
  const [role, setRole] = React.useState("viewer");
  const [docType, setDocType] = React.useState("contract");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{ label: string; href: string } | null>(null);

  const sel = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

  async function convert() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/business-cards/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, contactType, role, docType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || "Conversion failed.");
      setResult({ label: json.label || "Record", href: json.href || "#" });
      onConverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Save lead to…</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{lead.name || "—"}</span>
          {lead.email && <> · {lead.email}</>}{lead.phone && <> · {lead.phone}</>}{lead.company && <> · {lead.company}</>}
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved “{result.label}”.
            </div>
            <div className="flex justify-end gap-2">
              <a href={result.href}><Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5" /> Open</Button></a>
              <Button size="sm" variant="accent" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Destination</label>
              <select className={sel} value={target} onChange={(e) => setTarget(e.target.value as ConvertTarget)}>
                {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {target === "contact" && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact type</label>
                <select className={sel} value={contactType} onChange={(e) => setContactType(e.target.value)}>
                  {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            {target === "user" && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">User role</label>
                <select className={sel} value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">Creates a pending staff record — invite them from Users to enable login.</p>
              </div>
            )}
            {target === "document" && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Document type</label>
                <select className={sel} value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}

            {error && <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={convert} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Save
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
