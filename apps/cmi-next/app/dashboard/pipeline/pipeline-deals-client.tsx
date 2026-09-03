"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, UserPlus, X, Loader2, Phone, MessageSquare, Mail, StickyNote,
  Mic, Sparkles, Package, CalendarClock, Users2, MapPin, ScanLine, CheckCircle2,
  Circle, ArrowRight, Clock, TrendingUp, Trophy, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEAL_STAGE_META, DEAL_STAGES, LOST_REASONS, DEAL_SOURCES } from "@/lib/deals/stages";
import type { Deal, DealStage, Activity, ActivityType, DealTask, DealStageHistoryRow } from "@/lib/deals/types";

export type OwnerOption = { id: string; name: string };
export type SourceRow = { id: string; label: string; sub: string };

const TONE_CLASS: Record<string, string> = {
  info: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  accent: "bg-accent/15 text-accent",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = {
  call: Phone, sms: MessageSquare, email: Mail, note: StickyNote, voice_note: Mic,
  ai_agent: Sparkles, selection: Package, appointment: CalendarClock, meeting: Users2,
  site_visit: MapPin, scan_3d: ScanLine,
};
const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Call", sms: "SMS", email: "Email", note: "Note", voice_note: "Voice note",
  ai_agent: "AI agent", selection: "Selection", appointment: "Appointment",
  meeting: "Meeting", site_visit: "Site visit", scan_3d: "3D scan",
};

const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function fmtWhen(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function StageBadge({ stage }: { stage: DealStage }) {
  const m = DEAL_STAGE_META[stage];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_CLASS[m.tone])}>{m.label}</span>;
}

export function PipelineDealsClient({
  initialDeals, owners, contacts, quotes, submissions, canWrite,
}: {
  initialDeals: Deal[]; owners: OwnerOption[]; contacts: SourceRow[]; quotes: SourceRow[]; submissions: SourceRow[]; canWrite: boolean;
}) {
  const router = useRouter();
  const [deals, setDeals] = React.useState<Deal[]>(initialDeals);
  const [query, setQuery] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [showCreate, setShowCreate] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);

  const ownerName = React.useCallback((id: string | null) => owners.find((o) => o.id === id)?.name ?? "Unassigned", [owners]);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/deals");
    if (res.ok) setDeals(await res.json());
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (ownerFilter !== "all" && d.owner_id !== ownerFilter) return false;
      if (!q) return true;
      return [d.title, d.job_number, d.next_action, d.source].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [deals, query, ownerFilter]);

  const openDeals = deals.filter((d) => DEAL_STAGE_META[d.stage].open);
  const stats = {
    open: openDeals.length,
    value: openDeals.reduce((sum, d) => sum + (d.estimated_value ?? 0), 0),
    won: deals.filter((d) => d.stage === "closed_won").length,
    dueToday: deals.filter((d) => d.next_action_due && d.next_action_due <= new Date().toISOString().slice(0, 10) && DEAL_STAGE_META[d.stage].open).length,
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header + stat cards */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">Leads and opportunities from first inquiry to Closed Won.</p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4" /> Add to Pipeline</Button>
              <Button variant="accent" size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Deal</Button>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={TrendingUp} label="Open deals" value={String(stats.open)} tone="accent" />
          <StatCard icon={TrendingUp} label="Pipeline value" value={money(stats.value)} tone="success" />
          <StatCard icon={Trophy} label="Closed Won" value={String(stats.won)} tone="success" />
          <StatCard icon={CalendarDays} label="Follow-ups due" value={String(stats.dueToday)} tone={stats.dueToday ? "warning" : "muted"} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 md:px-6">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals…" className="pl-8" />
        </div>
        <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-auto min-w-[150px]">
          <option value="all">All Owners</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </div>

      {/* List view */}
      <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No deals yet. {canWrite && "Use “Add Deal” or “Add to Pipeline” to get started."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Deal</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium text-right">Value</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Last activity</th>
                  <th className="px-3 py-2 font-medium">Next action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const overdue = d.next_action_due && d.next_action_due < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={d.id} onClick={() => router.push(`/dashboard/pipeline/${d.id}`)} className="cursor-pointer border-t border-border transition hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{d.title}</div>
                        {d.job_number && <div className="font-mono text-[11px] text-muted-foreground">{d.job_number}</div>}
                      </td>
                      <td className="px-3 py-2.5"><StageBadge stage={d.stage} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(d.estimated_value)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{ownerName(d.owner_id)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {d.last_activity_at ? `${daysSince(d.last_activity_at)}d ago` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {d.next_action ? (
                          <div>
                            <div className="truncate max-w-[220px]">{d.next_action}</div>
                            {d.next_action_due && <div className={cn("text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>{fmtDate(d.next_action_due)}{overdue ? " · overdue" : ""}</div>}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <DealFormModal
          owners={owners} contacts={contacts} title="Add Deal"
          onClose={() => setShowCreate(false)}
          onSaved={async () => { setShowCreate(false); await refresh(); }}
        />
      )}
      {showAdd && (
        <AddToPipelineModal
          contacts={contacts} quotes={quotes} submissions={submissions} deals={deals}
          onClose={() => setShowAdd(false)}
          onAdded={async () => { setShowAdd(false); await refresh(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid h-6 w-6 place-items-center rounded-md", TONE_CLASS[tone])}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
// ─── Create-deal modal ────────────────────────────────────────────
function DealFormModal({
  owners, contacts, title, onClose, onSaved,
}: {
  owners: OwnerOption[]; contacts: SourceRow[]; title: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    title: "", contact_id: "", owner_id: "", source: "", estimated_value: "",
    target_start_date: "", next_action: "", next_action_due: "", notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError(null);
    const payload = {
      title: form.title,
      contact_id: form.contact_id || null,
      owner_id: form.owner_id || null,
      source: form.source || null,
      estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value),
      target_start_date: form.target_start_date || null,
      next_action: form.next_action || null,
      next_action_due: form.next_action_due || null,
      notes: form.notes || null,
    };
    const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to create deal."); return; }
    await onSaved();
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Deal title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Waters Residence — Kitchen remodel" /></Field>
        <Field label="Contact">
          <SearchableSelect
            value={form.contact_id}
            onChange={(v) => set("contact_id", v)}
            options={contacts.map((c) => ({ value: c.id, label: c.label, sublabel: c.sub }))}
            placeholder="Search contacts…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            <Select value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">Unassigned</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">—</option>
              {DEAL_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Estimated value"><MoneyInput value={form.estimated_value} onChange={(v) => set("estimated_value", v)} /></Field>
          <Field label="Target start date"><Input type="date" value={form.target_start_date} onChange={(e) => set("target_start_date", e.target.value)} /></Field>
          <Field label="Next action"><Input value={form.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="e.g. Call to schedule site visit" /></Field>
          <Field label="Next action due"><Input type="date" value={form.next_action_due} onChange={(e) => set("next_action_due", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[70px]" /></Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Deal</Button>
      </div>
    </ModalShell>
  );
}

// ─── Add-to-Pipeline modal (multi-select from a source) ───────────
function AddToPipelineModal({
  contacts, quotes, submissions, deals, onClose, onAdded,
}: {
  contacts: SourceRow[]; quotes: SourceRow[]; submissions: SourceRow[]; deals: Deal[];
  onClose: () => void; onAdded: () => Promise<void>;
}) {
  const [sourceType, setSourceType] = React.useState<"contact" | "quote" | "contact_submission">("contact");
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const rows = sourceType === "contact" ? contacts : sourceType === "quote" ? quotes : submissions;
  const alreadyIn = React.useMemo(
    () => new Set(deals.filter((d) => d.source_type === sourceType && d.source_id).map((d) => d.source_id as string)),
    [deals, sourceType],
  );
  const filtered = rows.filter((r) => !query || `${r.label} ${r.sub}`.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function switchSource(t: typeof sourceType) { setSourceType(t); setPicked(new Set()); setQuery(""); }

  async function submit() {
    if (!picked.size) return;
    setSaving(true);
    const res = await fetch("/api/deals/add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_type: sourceType, ids: Array.from(picked) }),
    });
    setSaving(false);
    if (res.ok) await onAdded();
  }

  const TABS = [
    { key: "contact" as const, label: "Contacts" },
    { key: "quote" as const, label: "Leads" },
    { key: "contact_submission" as const, label: "Form Submissions" },
  ];

  return (
    <ModalShell title="Add to Pipeline" onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchSource(t.key)}
            className={cn("border-b-2 px-3 py-2 text-sm font-medium transition", sourceType === t.key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-8" />
      </div>
      <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show.</p>
        ) : filtered.map((r) => {
          const inPipeline = alreadyIn.has(r.id);
          const checked = picked.has(r.id);
          return (
            <label key={r.id} className={cn("flex items-center gap-3 border-b border-border px-3 py-2 last:border-0", inPipeline ? "opacity-50" : "cursor-pointer hover:bg-muted/40")}>
              <input type="checkbox" disabled={inPipeline} checked={checked} onChange={() => toggle(r.id)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.label}</div>
                {r.sub && <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>}
              </div>
              {inPipeline && <span className="shrink-0 text-[11px] text-muted-foreground">In pipeline</span>}
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{picked.size} selected</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} disabled={saving || !picked.size}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add {picked.size || ""} to Pipeline
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn("max-h-[90vh] w-full overflow-auto rounded-xl bg-card p-5 shadow-xl", wide ? "max-w-2xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
