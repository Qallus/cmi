"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MessageSquare, CalendarClock, StickyNote, Mic, Sparkles,
  FolderKanban, FileText, ScrollText, FileSignature, Package, ReceiptText, Trophy,
  Ban, Check, ChevronRight, Loader2, X, Pencil, CircleDot, Circle, CheckCircle2,
  Clock, ArrowRight, Plus, Maximize2, Minimize2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { BoltModal } from "@/components/dashboard/bolt-modal";
import { CallsWorkspace } from "@/app/dashboard/communications/calls-workspace";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { DEAL_STAGE_META, DEAL_STAGES, DEAL_STAGE_CHECKLIST, LOST_REASONS } from "@/lib/deals/stages";
import type { Activity, ActivityType, Deal, DealChecklistProgress, DealStage, DealStageHistoryRow, DealTask } from "@/lib/deals/types";

export type OwnerOption = { id: string; name: string };
export type DealContact = { id: string; name: string; email: string | null; phone: string | null; company: string | null; role: string | null; tags: string[] | null };

const JOB_TYPES = ["Whole Home Remodel", "Kitchen", "Bathroom Remodel", "ADU/Casita", "Addition", "New Build", "Tenant Improvement", "Warranty", "Service Work", "Other"];

const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null);

const ACTIVITY_META: Record<ActivityType, { icon: typeof Phone; label: string }> = {
  call: { icon: Phone, label: "Call" }, sms: { icon: MessageSquare, label: "Text" }, email: { icon: Mail, label: "Email" },
  note: { icon: StickyNote, label: "Note" }, voice_note: { icon: Mic, label: "Voice note" }, ai_agent: { icon: Sparkles, label: "AI Agent" },
  selection: { icon: Package, label: "Selection" }, appointment: { icon: CalendarClock, label: "Appointment" }, meeting: { icon: CalendarClock, label: "Meeting" },
  site_visit: { icon: FolderKanban, label: "Site visit" }, scan_3d: { icon: FolderKanban, label: "3D scan" },
};

// Quick-action rail definition.
type ActionKey = "call" | "email" | "text" | "schedule" | "note" | "voice" | "ai" | "project" | "contract" | "sow" | "quote" | "selection" | "invoice";
const ACTIONS: { key: ActionKey; label: string; icon: typeof Phone }[] = [
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "text", label: "Text", icon: MessageSquare },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
  { key: "note", label: "Note", icon: StickyNote },
  { key: "voice", label: "Voice note", icon: Mic },
  { key: "ai", label: "AI Agent", icon: Sparkles },
  { key: "project", label: "Project", icon: FolderKanban },
  { key: "contract", label: "Contract", icon: FileSignature },
  { key: "sow", label: "SOW", icon: ScrollText },
  { key: "quote", label: "Quote", icon: FileText },
  { key: "selection", label: "Selection", icon: Package },
  { key: "invoice", label: "Invoice", icon: ReceiptText },
];

export function DealDetailClient({
  deal: initialDeal, contact, owners, canWrite, initialActivities, initialTasks, initialHistory, initialChecklist,
}: {
  deal: Deal; contact: DealContact | null; owners: OwnerOption[]; canWrite: boolean;
  initialActivities: Activity[]; initialTasks: DealTask[]; initialHistory: DealStageHistoryRow[]; initialChecklist: DealChecklistProgress[];
}) {
  const router = useRouter();
  const [deal, setDeal] = React.useState(initialDeal);
  const [activities, setActivities] = React.useState(initialActivities);
  const [tasks, setTasks] = React.useState(initialTasks);
  const [history, setHistory] = React.useState(initialHistory);
  const [done, setDone] = React.useState<Set<string>>(new Set(initialChecklist.map((c) => c.item_key)));
  const [action, setAction] = React.useState<ActionKey | null>(null);
  const [showAI, setShowAI] = React.useState(false);
  const [editKey, setEditKey] = React.useState(false);
  const [tab, setTab] = React.useState<ActivityType | "all">("all");
  const [busy, setBusy] = React.useState(false);

  const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name ?? "Unassigned";

  const refresh = React.useCallback(async () => {
    const [d, a, t, h, c] = await Promise.all([
      fetch(`/api/deals/${deal.id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/deals/${deal.id}/activities`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/deals/${deal.id}/tasks`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/deals/${deal.id}/stage`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/deals/${deal.id}/checklist`).then((r) => (r.ok ? r.json() : [])),
    ]);
    if (d) setDeal(d);
    setActivities(a); setTasks(t); setHistory(h);
    setDone(new Set((c as DealChecklistProgress[]).map((x) => x.item_key)));
  }, [deal.id]);

  async function changeStage(to: DealStage, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/stage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, ...extra }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error || "Stage change failed."); return; }
      await refresh();
    } finally { setBusy(false); }
  }

  async function toggleItem(itemKey: string, next: boolean) {
    setDone((prev) => { const n = new Set(prev); if (next) n.add(itemKey); else n.delete(itemKey); return n; });
    await fetch(`/api/deals/${deal.id}/checklist`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_key: itemKey, done: next }),
    });
  }

  async function logActivity(type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) {
    await fetch(`/api/deals/${deal.id}/activities`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, summary, body: body ?? null, metadata: metadata ?? {} }),
    });
    await refresh();
  }

  async function toggleTask(t: DealTask) {
    await fetch(`/api/deals/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed_at: t.completed_at ? null : new Date().toISOString() }) });
    await refresh();
  }

  const meta = DEAL_STAGE_META[deal.stage];
  const checklistItems = DEAL_STAGE_CHECKLIST[deal.stage] ?? [];
  const doneCount = checklistItems.filter((i) => done.has(i.key)).length;
  const nextStage = DEAL_STAGES.find((s) => DEAL_STAGE_META[s].order === meta.order + 1 && DEAL_STAGE_META[s].open !== false);
  const enteredStageAt = [...history].reverse().find((h) => h.to_stage === deal.stage)?.changed_at ?? deal.created_at;

  const filteredActs = tab === "all" ? activities : activities.filter((a) => a.type === tab);
  const summaryCounts = (["call", "sms", "email", "note", "voice_note", "ai_agent", "appointment"] as ActivityType[])
    .map((t) => ({ t, n: activities.filter((a) => a.type === t).length }));

  // Per-tab counts + "new since last viewed" (tracked per deal in localStorage).
  const [seenAt] = React.useState<number>(() => { try { return Number(localStorage.getItem(`deal-acts-seen-${deal.id}`)) || 0; } catch { return 0; } });
  React.useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(`deal-acts-seen-${deal.id}`, String(Date.now())); } catch { /* ignore */ } }, 1500);
    return () => clearTimeout(t);
  }, [deal.id, activities.length]);
  const countFor = (t: ActivityType | "all") => (t === "all" ? activities : activities.filter((a) => a.type === t)).length;
  const newFor = (t: ActivityType | "all") => (t === "all" ? activities : activities.filter((a) => a.type === t)).filter((a) => new Date(a.occurred_at).getTime() > seenAt).length;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 md:px-6">
        <button onClick={() => router.push("/dashboard/pipeline")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to pipeline</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"><FolderKanban className="h-5 w-5" /></span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Deal</div>
              <h1 className="font-display text-2xl font-semibold">{deal.title}</h1>
            </div>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={busy || deal.stage === "closed_won"} onClick={() => changeStage("closed_won")}><Trophy className="h-4 w-4" /> Closed Won</Button>
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" disabled={busy || deal.stage === "lost_on_hold"} onClick={() => { const reason = window.prompt("Reason (lost / on hold):", ""); if (reason !== null) changeStage("lost_on_hold", { patch: { lost_reason: reason || "unspecified" } }); }}><Ban className="h-4 w-4" /> Closed Lost</Button>
            </div>
          )}
        </div>
        {/* Summary strip */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border p-4 md:grid-cols-4 lg:grid-cols-5">
          <Summary label="Account / Contact" value={contact?.name ?? "—"} />
          <Summary label="Close date" value={fmtDate(deal.expected_close_date)} />
          <Summary label="Amount" value={money(deal.estimated_value)} />
          <Summary label="Owner" value={ownerName(deal.owner_id)} />
          <Summary label="Stage" value={<span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{meta.label}</span>} />
        </div>
      </div>

      {/* Stage stepper */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3 md:px-6">
        {DEAL_STAGES.filter((s) => s !== "lost_on_hold").map((s) => {
          const m = DEAL_STAGE_META[s];
          const isCurrent = s === deal.stage;
          const isPast = m.order < meta.order && meta.order !== 99;
          return (
            <button key={s} type="button" disabled={!canWrite || busy} onClick={() => changeStage(s)}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition min-w-[110px]",
                isCurrent ? "bg-accent text-accent-foreground" : isPast ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
              {isPast && <Check className="h-3.5 w-3.5" />} {m.label}
            </button>
          );
        })}
        {canWrite && nextStage && (
          <Button size="sm" variant="accent" disabled={busy || doneCount < checklistItems.filter((i) => i.required).length} onClick={() => changeStage(nextStage)}>
            <Check className="h-4 w-4" /> Mark stage complete
          </Button>
        )}
      </div>

      {/* Body grid */}
      <div className="grid gap-4 p-4 md:px-6 lg:grid-cols-[164px_minmax(0,1fr)_300px]">
        {/* Quick action rail */}
        <aside className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5">
          {ACTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" disabled={!canWrite} title={label}
              onClick={() => (key === "ai" ? setShowAI(true) : setAction(key))}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-accent disabled:opacity-40 lg:w-full">
              <Icon className="h-4 w-4 shrink-0" /> <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </aside>

        {/* Center column */}
        <div className="min-w-0 space-y-4">
          {/* Contact + key fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Lead / Contact details" action={contact && <a href={`/dashboard/contacts?id=${contact.id}`} className="text-xs text-accent hover:underline">Open contact →</a>}>
              {contact ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{contact.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                    <div><div className="font-semibold">{contact.name}</div>{contact.role && <div className="text-xs text-muted-foreground">{contact.role}</div>}</div>
                  </div>
                  <Field label="Email">{contact.email ? <button onClick={() => canWrite && setAction("email")} className="text-accent hover:underline">{contact.email}</button> : "—"}</Field>
                  <Field label="Phone">{contact.phone ? <button onClick={() => canWrite && setAction("call")} className="text-accent hover:underline">{contact.phone}</button> : "—"}</Field>
                  {contact.company && <Field label="Company">{contact.company}</Field>}
                  {contact.tags?.length ? <Field label="Tags"><span className="flex flex-wrap gap-1">{contact.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}</span></Field> : null}
                </div>
              ) : <p className="text-sm text-muted-foreground">No contact linked to this deal.</p>}
            </Card>

            <Card title="Key fields" action={canWrite && <button onClick={() => setEditKey(true)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Pencil className="h-3 w-3" /> Edit</button>}>
              <div className="space-y-2.5">
                <Field label="Estimated amount">{money(deal.estimated_value)}</Field>
                <Field label="Expected close">{fmtDate(deal.expected_close_date)}</Field>
                <Field label="Job type">{deal.job_type || "—"}</Field>
                <Field label="Location">{deal.full_address || "—"}</Field>
                <Field label="Probability">{deal.probability != null ? `${deal.probability}%` : "—"}</Field>
                <Field label="Last activity">{deal.last_activity_at ? `${daysSince(deal.last_activity_at)}d ago` : "—"}</Field>
                <Field label="Days in stage">{`${daysSince(enteredStageAt) ?? 0}d`}</Field>
                <Field label="Next step">{deal.next_action ? <span>{deal.next_action}{deal.next_action_due ? ` · ${fmtDate(deal.next_action_due)}` : ""}</span> : <button onClick={() => canWrite && setEditKey(true)} className="text-accent hover:underline">Set a next step</button>}</Field>
              </div>
            </Card>
          </div>

          {/* Completion items */}
          <Card title={`Completion items · ${doneCount}/${checklistItems.length}`}>
            <ul className="space-y-1.5">
              {checklistItems.map((item) => {
                const isDone = done.has(item.key);
                return (
                  <li key={item.key} className="flex items-center gap-2">
                    <button disabled={!canWrite} onClick={() => toggleItem(item.key, !isDone)} className="shrink-0 text-accent disabled:opacity-50">
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <span className={cn("flex-1 text-sm", isDone && "text-muted-foreground line-through")}>{item.label}</span>
                    {item.required && !isDone && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Required</span>}
                  </li>
                );
              })}
              {checklistItems.length === 0 && <li className="text-sm text-muted-foreground">No items for this stage.</li>}
            </ul>
          </Card>

          {/* Activity timeline */}
          <Card title="Activity timeline" action={
            <div className="flex flex-wrap gap-1 text-xs">
              {(["all", "call", "email", "sms", "note", "voice_note", "ai_agent", "appointment"] as const).map((t) => {
                const count = countFor(t);
                const fresh = newFor(t);
                return (
                  <button key={t} onClick={() => setTab(t)} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition", tab === t ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
                    {t === "all" ? "All" : ACTIVITY_META[t as ActivityType].label}
                    {count > 0 && (
                      <span className={cn("inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4",
                        fresh > 0 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          }>
            {filteredActs.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
              <ul className="space-y-3">
                {filteredActs.map((a) => {
                  const M = ACTIVITY_META[a.type] ?? ACTIVITY_META.note;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted"><M.icon className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{a.summary || M.label}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtWhen(a.occurred_at)}</span>
                        </div>
                        {a.type === "voice_note" && (a.metadata?.audio_url || a.body)
                          ? <audio controls src={String(a.metadata?.audio_url ?? a.body)} className="mt-1 h-8 w-full max-w-xs" />
                          : a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{M.label}{a.created_by_name ? ` · ${a.created_by_name}` : ""}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card title="Activity summary">
            <ul className="space-y-1.5 text-sm">
              {summaryCounts.map(({ t, n }) => (
                <li key={t} className="flex items-center justify-between"><span className="text-muted-foreground">{ACTIVITY_META[t].label}s</span><span className="font-semibold tabular-nums">{n}</span></li>
              ))}
            </ul>
          </Card>

          <Card title="Tasks">
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks.</p> : (
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <button disabled={!canWrite} onClick={() => toggleTask(t)} className="shrink-0 text-accent disabled:opacity-50">{t.completed_at ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}</button>
                    <span className={cn("flex-1 text-sm", t.completed_at && "text-muted-foreground line-through")}>{t.title}</span>
                    {t.due_at && <span className="text-[11px] text-muted-foreground">{fmtDate(t.due_at)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Stage history">
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
              <ul className="space-y-2">
                {[...history].reverse().map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-xs">
                    <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <div>
                      <div className="font-medium">{DEAL_STAGE_META[h.to_stage as DealStage]?.label ?? h.to_stage}</div>
                      <div className="text-muted-foreground">{fmtWhen(h.changed_at)}{h.changed_by ? ` · ${h.changed_by}` : ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Action modals */}
      {action && <ActionSheet action={action} deal={deal} contact={contact} owners={owners} ownerName={ownerName} onClose={() => setAction(null)} onDone={async () => { setAction(null); await refresh(); }} logActivity={logActivity} />}
      {showAI && <BoltModal context={`Pipeline deal: ${deal.title}`} onClose={() => setShowAI(false)} />}
      {editKey && <EditKeyFieldsModal deal={deal} owners={owners} onClose={() => setEditKey(false)} onSaved={async () => { setEditKey(false); await refresh(); }} />}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-medium">{value}</div></div>;
}
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{children}</span></div>;
}

// ─── Edit key fields ──────────────────────────────────────────────
function EditKeyFieldsModal({ deal, owners, onClose, onSaved }: { deal: Deal; owners: OwnerOption[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = React.useState({
    estimated_value: deal.estimated_value != null ? String(deal.estimated_value) : "",
    expected_close_date: deal.expected_close_date ?? "",
    job_type: deal.job_type ?? "",
    probability: deal.probability != null ? String(deal.probability) : "",
    owner_id: deal.owner_id ?? "",
    next_action: deal.next_action ?? "",
    next_action_due: deal.next_action_due ?? "",
    street_address: deal.street_address ?? "",
    city: deal.city ?? "",
    state: deal.state ?? "",
    zip: deal.zip ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setSaving(true);
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimated_value: f.estimated_value === "" ? null : Number(f.estimated_value),
        expected_close_date: f.expected_close_date || null,
        job_type: f.job_type || null,
        probability: f.probability === "" ? null : Number(f.probability),
        owner_id: f.owner_id || null,
        next_action: f.next_action || null,
        next_action_due: f.next_action_due || null,
        street_address: f.street_address || null,
        city: f.city || null,
        state: f.state || null,
        zip: f.zip || null,
      }),
    });
    setSaving(false);
    await onSaved();
  }
  return (
    <ModalShell title="Edit deal details" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="Estimated amount"><MoneyInput value={f.estimated_value} onChange={(v) => set("estimated_value", v)} /></L>
        <L label="Expected close"><Input type="date" value={f.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} /></L>
        <L label="Job type"><Select value={f.job_type} onChange={(e) => set("job_type", e.target.value)}><option value="">—</option>{JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></L>
        <L label="Probability (%)"><Input type="number" min={0} max={100} value={f.probability} onChange={(e) => set("probability", e.target.value)} /></L>
        <L label="Owner"><Select value={f.owner_id} onChange={(e) => set("owner_id", e.target.value)}><option value="">Unassigned</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></L>
        <L label="Next action due"><Input type="date" value={f.next_action_due} onChange={(e) => set("next_action_due", e.target.value)} /></L>
        <L label="Next action" full><Input value={f.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="e.g. Send proposal" /></L>
        <L label="Project address" full><Input value={f.street_address} onChange={(e) => set("street_address", e.target.value)} placeholder="Street address" /></L>
        <L label="City"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
        <L label="State"><Input value={f.state} onChange={(e) => set("state", e.target.value)} /></L>
        <L label="ZIP"><Input value={f.zip} onChange={(e) => set("zip", e.target.value)} /></L>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Saving an address geocodes the deal for the pipeline Map view.</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</Button></div>
    </ModalShell>
  );
}

// ─── Action sheet (one component, per-action form) ────────────────
function ActionSheet({
  action, deal, contact, owners, ownerName, onClose, onDone, logActivity,
}: {
  action: ActionKey; deal: Deal; contact: DealContact | null; owners: OwnerOption[]; ownerName: (id: string | null) => string;
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  // Call opens the live browser dialer (compact — no logs).
  if (action === "call") {
    return (
      <ModalShell title={`Call ${contact?.name ?? ""}`.trim()} onClose={onClose}>
        <div className="space-y-4">
          <CallsWorkspace hideLog initialNumber={contact?.phone ?? ""} />
          <QuickLog label="Log call outcome" onLog={async (summary, body) => { await logActivity("call", summary || "Call", body); await onDone(); }} />
        </div>
      </ModalShell>
    );
  }
  if (action === "schedule") return <ScheduleModal deal={deal} contact={contact} owners={owners} onClose={onClose} onDone={onDone} logActivity={logActivity} />;
  if (action === "voice") return <VoiceNoteModal onClose={onClose} onDone={onDone} logActivity={logActivity} />;
  if (action === "selection") return <SelectionPickerModal onClose={onClose} onDone={onDone} logActivity={logActivity} />;
  if (action === "note") return <NoteModal onClose={onClose} onDone={onDone} logActivity={logActivity} />;
  return <ActionModal action={action} deal={deal} contact={contact} owners={owners} ownerName={ownerName} onClose={onClose} onDone={onDone} logActivity={logActivity} />;
}

function QuickLog({ label, onLog }: { label: string; onLog: (summary: string, body: string) => Promise<void> }) {
  const [s, setS] = React.useState(""); const [b, setB] = React.useState(""); const [busy, setBusy] = React.useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <Input value={s} onChange={(e) => setS(e.target.value)} placeholder="Summary (e.g. Left voicemail)" />
      <Textarea value={b} onChange={(e) => setB(e.target.value)} placeholder="Details (optional)" className="mt-2 min-h-[60px]" />
      <div className="mt-2 flex justify-end"><Button size="sm" variant="accent" disabled={busy || !s.trim()} onClick={async () => { setBusy(true); await onLog(s, b); setBusy(false); }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log</Button></div>
    </div>
  );
}

function ActionModal({
  action, deal, contact, owners, ownerName, onClose, onDone, logActivity,
}: {
  action: ActionKey; deal: Deal; contact: DealContact | null; owners: OwnerOption[]; ownerName: (id: string | null) => string;
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = React.useState<Record<string, string>>({
    subject: action === "email" ? "" : "",
    body: "",
    title: deal.title,
    value: deal.estimated_value != null ? String(deal.estimated_value) : "",
    when: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Email templates (loaded for the Email action; selecting one fills the fields).
  const [templates, setTemplates] = React.useState<{ id: string; name: string; subject: string | null }[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  React.useEffect(() => {
    if (action !== "email") return;
    (async () => { const r = await fetch("/api/admin/email-templates"); if (r.ok) { const j = await r.json(); setTemplates(j.templates ?? []); } })();
  }, [action]);
  async function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const r = await fetch(`/api/admin/email-templates/${id}`);
    if (r.ok) { const j = await r.json(); const t = j.template ?? {}; setF((p) => ({ ...p, subject: t.subject || p.subject, body: t.html || t.plain_text || p.body })); }
  }

  const TITLES: Record<ActionKey, string> = {
    call: "Call", email: "Email", text: "Text", schedule: "Schedule", note: "Note", voice: "Voice note",
    ai: "AI Agent", project: "Create project", contract: "Create contract", sow: "Create SOW",
    quote: "Create quote", selection: "Create selection", invoice: "Create invoice",
  };

  async function submit() {
    setBusy(true); setErr(null);
    try {
      switch (action) {
        case "email": {
          if (!contact?.email) throw new Error("No email on file for this contact.");
          const r = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "email", to: contact.email, subject: f.subject, body: f.body }) });
          if (!r.ok) throw new Error((await r.json()).error || "Send failed.");
          await logActivity("email", f.subject || "Email sent", f.body);
          break;
        }
        case "text": {
          if (!contact?.phone) throw new Error("No phone on file for this contact.");
          const r = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "sms", to: contact.phone, body: f.body }) });
          if (!r.ok) throw new Error((await r.json()).error || "Send failed.");
          await logActivity("sms", "Text sent", f.body);
          break;
        }
        case "note": {
          await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: f.title, body: f.body }) }).catch(() => {});
          await logActivity("note", f.title || "Note", f.body);
          break;
        }
        case "voice": {
          await logActivity("voice_note", f.title || "Voice note", f.body);
          break;
        }
        case "schedule": {
          if (!f.when) throw new Error("Pick a date and time.");
          await logActivity("appointment", f.title || "Appointment", f.body, { when: f.when });
          break;
        }
        case "quote": {
          const r = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_id: contact?.id ?? null, name: f.title, email: contact?.email ?? null, phone: contact?.phone ?? null, estimated_value: f.value === "" ? null : Number(f.value), status: "New", description: f.body || null }) });
          if (!r.ok) throw new Error((await r.json()).error || "Quote failed.");
          await logActivity("note", `Quote created: ${f.title}`, f.body);
          break;
        }
        case "contract":
        case "sow": {
          const r = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: action, title: f.title, client: contact?.name ?? "", client_email: contact?.email ?? "", client_phone: contact?.phone ?? "", project: deal.title, value: f.value === "" ? null : Number(f.value) }) });
          if (!r.ok) throw new Error((await r.json()).error || "Document failed.");
          await logActivity("note", `${action === "sow" ? "SOW" : "Contract"} created: ${f.title}`, f.body);
          break;
        }
        case "project": {
          const r = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_name: f.title }) });
          if (!r.ok) throw new Error((await r.json()).error || "Job creation failed.");
          await logActivity("note", `Project created: ${f.title}`, f.body);
          break;
        }
        case "selection": {
          const r = await fetch("/api/admin/selections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.title, project_name: deal.title, client_id: contact?.id ?? null }) });
          if (!r.ok) throw new Error((await r.json()).error || "Selection failed.");
          await logActivity("selection", `Selection created: ${f.title}`, f.body);
          break;
        }
        case "invoice": {
          throw new Error("Invoices are created on a Job. Use the Project action to create/link a job first, then add invoices from the job.");
        }
      }
      await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title={TITLES[action]} onClose={onClose}>
      <div className="space-y-3">
        {action === "invoice" ? (
          <p className="text-sm text-muted-foreground">Invoices are created on a Job. Create or link a Job first (Project action), then add invoices from the job&apos;s Invoices tab.</p>
        ) : (
          <>
            {(action === "email") && (
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <L label="Subject"><Input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Subject" /></L>
                <L label="Template">
                  <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="">No template (manual)</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </L>
              </div>
            )}
            {(action === "text" || action === "email") && <p className="text-xs text-muted-foreground">To: {action === "email" ? (contact?.email ?? "—") : (contact?.phone ?? "—")}</p>}
            {(action === "note" || action === "voice" || action === "schedule" || action === "quote" || action === "contract" || action === "sow" || action === "project" || action === "selection") && (
              <L label={action === "quote" || action === "contract" || action === "sow" || action === "project" || action === "selection" ? "Title" : "Summary"} full>
                <Input value={f.title} onChange={(e) => set("title", e.target.value)} />
              </L>
            )}
            {action === "schedule" && <L label="When" full><Input type="datetime-local" value={f.when} onChange={(e) => set("when", e.target.value)} /></L>}
            {(action === "quote" || action === "contract" || action === "sow") && <L label="Value" full><MoneyInput value={f.value} onChange={(v) => set("value", v)} /></L>}
            <L label={action === "email" || action === "text" ? "Message" : "Details"} full><Textarea value={f.body} onChange={(e) => set("body", e.target.value)} className="min-h-[90px]" /></L>
          </>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {action !== "invoice" && <Button variant="accent" onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />} {action === "email" || action === "text" ? "Send" : "Create"}</Button>}
      </div>
    </ModalShell>
  );
}

// ─── Schedule: real availability slots → /api/admin/bookings ──────
type ApptType = { id: string; name: string; duration_minutes: number };
type Slot = { start: string; end: string; label: string };

function ScheduleModal({
  deal, contact, owners, onClose, onDone, logActivity,
}: {
  deal: Deal; contact: DealContact | null; owners: OwnerOption[];
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const [types, setTypes] = React.useState<ApptType[]>([]);
  const [typeId, setTypeId] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [slotStart, setSlotStart] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/booking/appointment-types");
      if (r.ok) { const j = await r.json(); const list = (j.appointmentTypes ?? []) as ApptType[]; setTypes(list); if (list[0]) setTypeId(list[0].id); }
    })();
  }, []);

  // Fetch availability whenever the type/date changes. State is set inside the
  // async task (after the tick), avoiding a synchronous setState in the effect.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!typeId || !date) { if (!cancelled) setSlots([]); return; }
      setLoadingSlots(true); setSlotStart("");
      const r = await fetch(`/api/booking/availability?appointment_type_id=${typeId}&date=${date}`);
      const j = r.ok ? await r.json() : { slots: [] };
      if (!cancelled) { setSlots((j.slots ?? []) as Slot[]); setLoadingSlots(false); }
    })();
    return () => { cancelled = true; };
  }, [typeId, date]);

  async function submit() {
    setErr(null);
    if (!contact?.email) { setErr("This deal's contact needs an email to book an appointment."); return; }
    if (!slotStart) { setErr("Pick an available time slot."); return; }
    setBusy(true);
    try {
      const [first, ...rest] = (contact.name || "Client").split(" ");
      const r = await fetch("/api/admin/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_type_id: typeId,
          start_time: slotStart,
          first_name: first, last_name: rest.join(" ") || first,
          email: contact.email, phone: contact.phone ?? undefined,
          project_name: deal.title, notes: notes || undefined,
          assigned_staff_user_id: assignee || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Booking failed.");
      const typeName = types.find((t) => t.id === typeId)?.name ?? "Appointment";
      const label = slots.find((s) => s.start === slotStart)?.label ?? fmtWhen(slotStart);
      await logActivity("appointment", `${typeName} · ${label}`, notes || undefined, { start_time: slotStart });
      await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Booking failed."); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title="Schedule appointment" onClose={onClose} wide>
      {!contact?.email ? (
        <p className="text-sm text-muted-foreground">This deal needs a contact with an email to book an appointment. Add a contact first.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Appointment type"><Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>{types.length === 0 && <option value="">Loading…</option>}{types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.duration_minutes}m)</option>)}</Select></L>
            <L label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></L>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Available times</div>
            {loadingSlots ? <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
              : slots.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No open slots for this day.</p>
              : <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-auto sm:grid-cols-4">
                  {slots.map((s) => (
                    <button key={s.start} type="button" onClick={() => setSlotStart(s.start)}
                      className={cn("rounded-md border px-2 py-1.5 text-xs font-medium transition", slotStart === s.start ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/40")}>
                      {s.label}
                    </button>
                  ))}
                </div>}
          </div>
          <L label="Assign to (optional)"><Select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></L>
          <L label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" /></L>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {contact?.email && <Button variant="accent" onClick={submit} disabled={busy || !slotStart}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Book</Button>}
      </div>
    </ModalShell>
  );
}

// ─── Voice note: record in-browser → upload → log ─────────────────
function VoiceNoteModal({
  onClose, onDone, logActivity,
}: {
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const [recording, setRecording] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [title, setTitle] = React.useState("Voice note");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b); setAudioUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = mr; mr.start(); setRecording(true);
    } catch { setErr("Microphone access denied or unavailable."); }
  }
  function stop() { recRef.current?.stop(); setRecording(false); }

  async function save() {
    if (!blob) return;
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" }));
      form.append("folder", "deal-voice-notes");
      const r = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Upload failed.");
      await logActivity("voice_note", title || "Voice note", j.url, { audio_url: j.url });
      await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title="Voice note" onClose={onClose}>
      <div className="space-y-3">
        <L label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></L>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-5">
          {!recording ? (
            <Button variant="accent" onClick={start}><Mic className="h-4 w-4" /> {audioUrl ? "Re-record" : "Start recording"}</Button>
          ) : (
            <Button variant="destructive" onClick={stop}><span className="h-2.5 w-2.5 rounded-sm bg-white" /> Stop</Button>
          )}
          {recording && <span className="flex items-center gap-1.5 text-xs text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording…</span>}
          {audioUrl && !recording && <audio controls src={audioUrl} className="w-full" />}
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={save} disabled={busy || !blob}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save voice note</Button>
      </div>
    </ModalShell>
  );
}

// ─── Note: rich-text editor (Workspace-style) ─────────────────────
function NoteModal({
  onClose, onDone, logActivity,
}: {
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title.trim() && !text) { setErr("Add a title or some content."); return; }
    setBusy(true); setErr(null);
    try {
      await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || "Note", body }) }).catch(() => {});
      await logActivity("note", title || "Note", text || undefined);
      await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title="Add a note" onClose={onClose} wide>
      <div className="space-y-3">
        <L label="Note title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Discovery call recap" /></L>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Note</span>
          <RichTextEditor value={body} onChange={setBody} placeholder="Write your note… format text, add links and images." />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Link href="/dashboard/documents" className="text-xs text-accent hover:underline">Open Workspace for a full document →</Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save note</Button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Selection: multi-select from existing selections ─────────────
function SelectionPickerModal({
  onClose, onDone, logActivity,
}: {
  onClose: () => void; onDone: () => Promise<void>; logActivity: (type: ActivityType, summary: string, body?: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const [rows, setRows] = React.useState<{ id: string; name: string; project_name?: string | null; status?: string | null }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/selections");
      const j = r.ok ? await r.json() : { selections: [] };
      setRows(j.selections ?? []); setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((s) => !query || `${s.name} ${s.project_name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  function toggle(id: string) { setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function attach() {
    if (!picked.size) return;
    setBusy(true);
    const chosen = rows.filter((s) => picked.has(s.id));
    await logActivity("selection", `Attached ${chosen.length} selection${chosen.length === 1 ? "" : "s"}`, chosen.map((s) => `• ${s.name}`).join("\n"), { selection_ids: [...picked] });
    setBusy(false);
    await onDone();
  }

  return (
    <ModalShell title="Attach selections" onClose={onClose} wide>
      <div className="relative mb-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search selections…" className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
      </div>
      <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
        {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
          : filtered.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No selections found.</p>
          : filtered.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/40">
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{s.name}</div>{s.project_name && <div className="truncate text-[11px] text-muted-foreground">{s.project_name}</div>}</div>
              {s.status && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{s.status}</span>}
            </label>
          ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{picked.size} selected</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={attach} disabled={busy || !picked.size}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Attach {picked.size || ""}</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn("flex flex-col overflow-hidden rounded-xl bg-card shadow-xl transition-all",
          expanded ? "h-[95vh] w-[95vw] max-w-[95vw]" : cn("max-h-[90vh] w-full", wide ? "max-w-2xl" : "max-w-lg"))}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded((v) => !v)} title={expanded ? "Minimize" : "Expand"} aria-label={expanded ? "Minimize" : "Expand"} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted">
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} title="Close" aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">{children}</div>
      </div>
    </div>
  );
}
function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={cn("block space-y-1", full && "sm:col-span-2")}><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}
