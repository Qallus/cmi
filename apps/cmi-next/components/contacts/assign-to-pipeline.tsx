"use client";

// Contacts → a contact → "Assign to Pipeline".
//
// Links this contact to an existing deal, at any stage, with their role on it.
// (The "+ Pipeline" menu item is different: it creates a new deal.) Also lists
// the deals the contact is already on.
import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Search, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/deals/types";

type DealOption = { id: string; title: string; job_number: string | null; stage: DealStage };
type OnDeal = { link_id: string; deal_id: string; title: string; job_number: string | null; stage: string; role: string | null; is_primary: boolean };

const ROLES = ["Homeowner", "Designer", "Architect", "General Contractor", "Referral Partner", "Property Manager", "Realtor", "Other"];
const stageLabel = (s: string) => DEAL_STAGE_META[s as DealStage]?.label ?? s;

export function ContactPipelineSection({ contactId }: { contactId: string }) {
  const [onDeals, setOnDeals] = React.useState<OnDeal[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deals, setDeals] = React.useState<DealOption[] | null>(null);
  const [q, setQ] = React.useState("");
  const [dealId, setDealId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [primary, setPrimary] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const loadOnDeals = React.useCallback(async () => {
    const res = await fetch(`/api/contacts/${contactId}/deals`);
    setOnDeals(res.ok ? await res.json() : []);
  }, [contactId]);
  React.useEffect(() => {
    const t = window.setTimeout(() => { void loadOnDeals(); }, 0);
    return () => window.clearTimeout(t);
  }, [loadOnDeals]);

  async function startAssign() {
    setOpen(true); setError(null); setFlash(null);
    if (!deals) {
      const res = await fetch("/api/deals");
      const list = res.ok ? ((await res.json()) as DealOption[]) : [];
      setDeals(list.map((d) => ({ id: d.id, title: (d.title ?? "").trim() || "Untitled deal", job_number: d.job_number ?? null, stage: d.stage })));
    }
  }

  async function assign() {
    if (!dealId || busy) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/deals/${dealId}/contacts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, role: role || null, is_primary: primary }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError((json as { error?: string }).error ?? "Couldn't assign."); return; }
    const deal = deals?.find((d) => d.id === dealId);
    setFlash(`Added to ${deal?.title ?? "the deal"}.`);
    setOpen(false); setDealId(""); setRole(""); setPrimary(false); setQ("");
    await loadOnDeals();
  }

  const already = new Set((onDeals ?? []).map((d) => d.deal_id));
  const needle = q.trim().toLowerCase();
  const options = (deals ?? []).filter((d) => !already.has(d.id))
    .filter((d) => !needle || d.title.toLowerCase().includes(needle) || (d.job_number ?? "").toLowerCase().includes(needle));

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Workflow className="h-3.5 w-3.5" /> Pipeline deals</h4>
        {!open && <Button size="sm" variant="outline" onClick={() => void startAssign()}><Workflow className="h-3.5 w-3.5" /> Assign to Pipeline</Button>}
      </div>

      {flash && <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent"><Check className="h-3.5 w-3.5" /> {flash}</p>}

      {onDeals === null ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
      ) : onDeals.length === 0 ? (
        !open && <p className="text-sm text-muted-foreground">Not on any deal yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {onDeals.map((d) => (
            <li key={d.link_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <Link href={`/dashboard/pipeline/${d.deal_id}`} className="min-w-0 truncate font-medium hover:underline">
                {[d.job_number, d.title].filter(Boolean).join(" · ")}
              </Link>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {d.role && <span>{d.role}</span>}
                {d.is_primary && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">Primary</span>}
                <span className="rounded-full bg-muted px-2 py-0.5">{stageLabel(d.stage)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals by name or job number"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
            {deals === null && <li className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading deals…</li>}
            {deals !== null && options.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No matching deals.</li>}
            {options.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setDealId(d.id)}
                  className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted", dealId === d.id && "bg-accent/10")}>
                  <span className="min-w-0 truncate">{[d.job_number, d.title].filter(Boolean).join(" · ")}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {stageLabel(d.stage)}
                    {dealId === d.id && <Check className="h-3.5 w-3.5 text-accent" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent">
              <option value="">Relation to the deal…</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              Make primary contact
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); setError(null); }}><X className="h-3.5 w-3.5" /> Cancel</Button>
            <Button size="sm" variant="accent" onClick={() => void assign()} disabled={!dealId || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Assign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
