"use client";

import * as React from "react";
import { Building2, Check, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/formatted-input";
import { TRADES, PARTNER_TYPES } from "@/lib/prequal/form";

export type CompanyOption = { id: string; name: string; trades: string[] };

/**
 * Pick the partner, or add one that is not in the directory yet.
 *
 * Every match is listed and the list scrolls — an earlier version capped it at
 * thirty rows, which with no search term meant you only ever saw companies
 * beginning with A and the picker looked broken.
 */
export function CompanyPicker({
  companies, value, onChange, preferTrade, onCreated,
}: {
  companies: CompanyOption[];
  value: string;
  onChange: (id: string) => void;
  /** The template's trade, floated to the top since it is usually the one. */
  preferTrade?: string | null;
  onCreated: (company: CompanyOption) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? companies.filter((c) => c.name.toLowerCase().includes(needle))
      : companies;
    if (!preferTrade) return found;
    return [...found].sort((a, b) => Number(b.trades.includes(preferTrade)) - Number(a.trades.includes(preferTrade)));
  }, [companies, query, preferTrade]);

  const selected = companies.find((c) => c.id === value) ?? null;

  if (adding) {
    return (
      <NewCompanyForm
        initialName={query.trim()}
        onCancel={() => setAdding(false)}
        onCreated={(c) => { setAdding(false); setQuery(""); onCreated(c); }}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Company</span>
        <span className="text-[11px] text-muted-foreground">
          {matches.length} of {companies.length}
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search partners…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-md border border-border">
        <button
          type="button" onClick={() => onChange("")}
          className={cn("flex w-full items-center px-3 py-1.5 text-left text-sm transition hover:bg-muted", !value && "bg-muted font-medium")}
        >
          No company yet
        </button>
        {matches.map((c) => (
          <button
            key={c.id} type="button" onClick={() => onChange(c.id)}
            className={cn("flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-muted", value === c.id && "bg-muted font-medium")}
          >
            <span className="truncate">{c.name}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {preferTrade && c.trades.includes(preferTrade) && (
                <span className="rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">{preferTrade}</span>
              )}
              {value === c.id && <Check className="h-3.5 w-3.5 text-accent" />}
            </span>
          </button>
        ))}
        {matches.length === 0 && (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            Nothing matches “{query.trim()}”.
          </p>
        )}
      </div>

      <button
        type="button" onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        {query.trim() ? `Add “${query.trim()}” as a new company` : "Add a company"}
      </button>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Anything already on their profile will be filled in, so you can confirm it rather than ask again.
        </p>
      )}
    </div>
  );
}

/** Enough to start an interview. Everything else the interview itself collects. */
function NewCompanyForm({
  initialName, onCancel, onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (c: CompanyOption) => void;
}) {
  const [name, setName] = React.useState(initialName);
  const [partnerType, setPartnerType] = React.useState("Subcontractor");
  const [trade, setTrade] = React.useState("");
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  async function create() {
    setBusy(true); setError(null); setWarning(null);
    const res = await fetch("/api/interviews/companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, partner_type: partnerType, trades: trade ? [trade] : [],
        phone, email,
        contact_first_name: first, contact_last_name: last,
        contact_email: email, contact_phone: phone,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not create the company."); setBusy(false); return; }
    setBusy(false);
    if (json.warning) setWarning(json.warning);
    onCreated({ id: json.company.id, name: json.company.name, trades: json.company.trades ?? [] });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4 text-accent" /> New company
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium">Company name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Valley Demolition LLC" autoFocus />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Type</span>
          <Select value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
            {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Trade</span>
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            <option value="">Not sure yet</option>
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </label>
      </div>

      <p className="text-[11px] text-muted-foreground">
        A contact is optional — leave it blank if you only have the company. Filling it in adds
        them to Contacts too.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">First name</span>
          <Input value={first} onChange={(e) => setFirst(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Last name</span>
          <Input value={last} onChange={(e) => setLast(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Phone</span>
          <PhoneInput value={phone} onChange={setPhone} />
        </label>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{error}</p>}
      {warning && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs">{warning}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:bg-muted">
          Cancel
        </button>
        <button
          type="button" disabled={busy || !name.trim()} onClick={() => void create()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
        </button>
      </div>
    </div>
  );
}
