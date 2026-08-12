"use client";

import * as React from "react";
import { ShieldCheck, RefreshCw, Search, MessageSquare, Mail, Check, Ban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Person = {
  recordType: "contact" | "user" | "lead";
  recordId: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsOptedOut: boolean | null;
  emailOptedOut: boolean | null;
};
type Counts = { smsOptedIn: number; smsOptedOut: number; emailOptedIn: number; emailOptedOut: number };

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");
const PUBLIC_PAGES: [string, string][] = [
  ["SMS opt-in", "/sms-opt-in"], ["SMS opt-out", "/sms-opt-out"],
  ["Email opt-in", "/email-opt-in"], ["Email opt-out", "/email-opt-out"],
];

const keyOf = (p: Person) => `${p.recordType}:${p.recordId}`;

export function MessagingConsentClient() {
  const [people, setPeople] = React.useState<Person[]>([]);
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"all" | "contact" | "user" | "lead">("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/consent");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setPeople(json.people ?? []);
      setCounts(json.counts ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function apply(channel: "sms" | "email", action: "opt_in" | "opt_out", targets: { address: string; recordType: string; recordId: string }[]) {
    if (!targets.length) return;
    await fetch("/api/admin/consent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, action, targets }),
    });
    await load();
  }

  function togglePerson(p: Person, channel: "sms" | "email") {
    const addr = channel === "sms" ? p.phone : p.email;
    if (!addr) return;
    const optedOut = channel === "sms" ? p.smsOptedOut : p.emailOptedOut;
    apply(channel, optedOut ? "opt_in" : "opt_out", [{ address: addr, recordType: p.recordType, recordId: p.recordId }]);
  }

  const filtered = React.useMemo(() => {
    const n = search.toLowerCase();
    return people.filter((p) =>
      (typeFilter === "all" || p.recordType === typeFilter) &&
      (!n || [p.name, p.email, p.phone].some((v) => String(v || "").toLowerCase().includes(n))),
    );
  }, [people, search, typeFilter]);

  function bulk(channel: "sms" | "email", action: "opt_in" | "opt_out") {
    const targets = filtered.filter((p) => selected.has(keyOf(p)))
      .map((p) => ({ address: (channel === "sms" ? p.phone : p.email) || "", recordType: p.recordType, recordId: p.recordId }))
      .filter((t) => t.address);
    apply(channel, action, targets).then(() => setSelected(new Set()));
  }

  function toggleSel(k: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  function selectAll() {
    setSelected((s) => s.size === filtered.length ? new Set() : new Set(filtered.map(keyOf)));
  }

  function copyUrl(path: string) {
    navigator.clipboard?.writeText(`${PUBLIC_BASE}${path}`);
    setCopied(path); setTimeout(() => setCopied(null), 1500);
  }

  const tiles = [
    { label: "SMS opted-in", value: counts?.smsOptedIn, tint: "text-emerald-500", icon: MessageSquare },
    { label: "SMS opt-out", value: counts?.smsOptedOut, tint: "text-red-500", icon: Ban },
    { label: "Email opted-in", value: counts?.emailOptedIn, tint: "text-emerald-500", icon: Mail },
    { label: "Email opt-out", value: counts?.emailOptedOut, tint: "text-red-500", icon: Ban },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Compliance</div>
          <h1 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"><ShieldCheck className="h-5 w-5 text-accent" /> Messaging Consent</h1>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>
      </div>

      <div className="p-5">
        {/* Counts */}
        <div className="mb-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&>*]:min-w-[42%] [&>*]:shrink-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 lg:[&>*]:min-w-0 [&::-webkit-scrollbar]:hidden">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><t.icon className={cn("h-3.5 w-3.5", t.tint)} />{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{counts ? t.value : "—"}</div>
            </div>
          ))}
        </div>

        {/* Public page URLs */}
        <div className="mb-4 rounded-xl border border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Public opt-in / opt-out pages (provide these URLs to Twilio)</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLIC_PAGES.map(([label, path]) => (
              <div key={path} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                <a href={path} target="_blank" rel="noreferrer" className="truncate hover:text-accent" title={`${PUBLIC_BASE}${path}`}>{label}</a>
                <button onClick={() => copyUrl(path)} className="shrink-0 text-muted-foreground hover:text-foreground">{copied === path ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…" className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent">
            <option value="all">All records</option><option value="contact">Contacts</option><option value="user">Users</option><option value="lead">Leads</option>
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length} people</span>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
            <span className="font-medium">{selected.size} selected</span>
            <span className="text-muted-foreground">SMS:</span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => bulk("sms", "opt_in")}>Opt in</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => bulk("sms", "opt_out")}>Opt out</Button>
            <span className="ml-2 text-muted-foreground">Email:</span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => bulk("email", "opt_in")}>Opt in</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => bulk("email", "opt_out")}>Opt out</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {error && <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-3 py-3"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={selectAll} /></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">SMS</th>
                <th className="px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !people.length ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No people found.</td></tr>
              ) : filtered.map((p) => (
                <tr key={keyOf(p)} className="hover:bg-muted/30">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(keyOf(p))} onChange={() => toggleSel(keyOf(p))} /></td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.phone || ""}{p.phone && p.email ? " · " : ""}{p.email || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{p.recordType}</td>
                  <td className="px-4 py-3"><ConsentPill state={p.smsOptedOut} onToggle={() => togglePerson(p, "sms")} /></td>
                  <td className="px-4 py-3"><ConsentPill state={p.emailOptedOut} onToggle={() => togglePerson(p, "email")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Click a status to toggle it. Opt-outs block all sends on that channel and are honored from STOP texts and the public pages above.</p>
      </div>
    </div>
  );
}

function ConsentPill({ state, onToggle }: { state: boolean | null; onToggle: () => void }) {
  if (state === null) return <span className="text-xs text-muted-foreground">—</span>;
  const optedOut = state === true;
  return (
    <button
      onClick={onToggle}
      className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition", optedOut ? "bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400" : "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400")}
      title={optedOut ? "Opted out — click to opt in" : "Opted in — click to opt out"}
    >
      {optedOut ? "Opted out" : "Opted in"}
    </button>
  );
}
