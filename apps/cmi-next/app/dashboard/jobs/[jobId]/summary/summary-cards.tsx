"use client";

// The live cards on a job's Summary page and the modals behind their "Add"
// links. Staff can pick up, check off and add work here without leaving the
// job. Data comes from lib/jobs/summary-feed.ts; after any change the page
// re-renders on the server (router.refresh) so every card stays in step.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Circle, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type ComboOption } from "@/components/ui/searchable-select";
import { PhoneInput } from "@/components/ui/formatted-input";
import { AddDailyLogDialog } from "@/components/dashboard/add-daily-log";
import { confirmAction } from "@/components/ui/confirm-action";
import { cn } from "@/lib/utils";
import type { JobSummaryFeed, SummaryTask } from "@/lib/jobs/summary-feed";
import type { ActionItem, ActionItemPriority } from "@/lib/action-items/types";
import { ModuleModal } from "../job-module-shell";

// ─── Shared atoms ─────────────────────────────────────────────────
export const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}

export function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{children}</div>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">{initials}</span>;
}

export function CardLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="shrink-0 text-xs text-accent hover:underline">{children}</button>;
}

function ErrorNote({ text }: { text: string | null }) {
  return text ? <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{text}</div> : null;
}

/** Re-render the page on the server so every card picks up a change. */
export function useRefresh() {
  const router = useRouter();
  return React.useCallback(() => router.refresh(), [router]);
}

async function postJson(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}
function errText(data: Record<string, unknown>, fallback: string): string {
  return (typeof data.error === "string" && data.error) || (typeof data.message === "string" && data.message) || fallback;
}

function shortDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}
function relative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type StaffOption = { id: string; label: string; email: string; role: string; job_title: string };
function useStaffOptions(): StaffOption[] | null {
  const [staff, setStaff] = React.useState<StaffOption[] | null>(null);
  React.useEffect(() => {
    fetch("/api/staff-options").then((r) => r.json()).then((d) => setStaff(d?.staff ?? [])).catch(() => setStaff([]));
  }, []);
  return staff;
}

const SOURCE_LABEL: Record<SummaryTask["source"], string> = { schedule: "Schedule", task: "Task", punch: "Punch" };

// ─── Task rows (Past Due / Due Today / Agenda) ────────────────────
function useTaskActions(jobId: string) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(async (task: SummaryTask, action: "complete" | "assign_me") => {
    setBusy(task.key); setError(null);
    const { ok, data } = await postJson(`/api/jobs/${jobId}/summary/tasks`, { action, source: task.source, id: task.id });
    setBusy(null);
    if (!ok) { setError(errText(data, "Couldn't update that item.")); return; }
    refresh();
  }, [jobId, refresh]);
  return { busy, error, run };
}

function TaskRow({ task, tag, tone, busy, onDone, onTake }: {
  task: SummaryTask; tag: string | null; tone?: "danger" | "warn"; busy: boolean;
  onDone: () => void; onTake?: () => void;
}) {
  return (
    <div className={cn("group flex items-start gap-2 py-1.5 text-sm", busy && "opacity-50")}>
      <button type="button" onClick={onDone} disabled={busy} title="Mark done" className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-accent">
        <Circle className="h-4 w-4 group-hover:hidden" /><Check className="hidden h-4 w-4 group-hover:block" />
      </button>
      <div className="min-w-0 flex-1">
        <Link href={task.href} className="line-clamp-2 hover:text-accent">{task.title}</Link>
        <div className="truncate text-[11px] text-muted-foreground">
          {SOURCE_LABEL[task.source]}{task.detail && task.source !== "task" ? ` · ${task.detail}` : ""} · {task.mine ? "You" : task.assignee ?? "Unassigned"}
          {onTake && !task.mine && <> · <button type="button" onClick={onTake} disabled={busy} className="text-accent hover:underline">Take it</button></>}
        </div>
      </div>
      {tag && <span className={cn("shrink-0 text-[11px]", tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{tag}</span>}
    </div>
  );
}

const SHOW = 6;
function MoreToggle({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  if (total <= SHOW) return null;
  return <button type="button" onClick={onToggle} className="mt-1 text-[11px] text-accent hover:underline">{open ? "Show less" : `Show all ${total}`}</button>;
}

export function PastDueCard({ jobId, feed }: { jobId: string; feed: JobSummaryFeed }) {
  const [adding, setAdding] = React.useState(false);
  const [everyone, setEveryone] = React.useState(false);
  const [all, setAll] = React.useState(false);
  const { busy, error, run } = useTaskActions(jobId);
  const pastDue = feed.tasks.filter((t) => t.due && t.due < feed.today);
  const mine = pastDue.filter((t) => t.mine);
  const others = pastDue.length - mine.length;
  const list = everyone ? pastDue : mine;
  return (
    <Card title="Past Due For You" action={<CardLink onClick={() => setAdding(true)}>Add</CardLink>}>
      <ErrorNote text={error} />
      {list.length === 0 ? <Empty>Nothing past due.</Empty> : (all ? list : list.slice(0, SHOW)).map((t) => (
        <TaskRow key={t.key} task={t} tag={`Was due ${shortDate(t.due as string)}`} tone="danger" busy={busy === t.key}
          onDone={() => void run(t, "complete")} onTake={everyone ? () => void run(t, "assign_me") : undefined} />
      ))}
      <MoreToggle total={list.length} open={all} onToggle={() => setAll((v) => !v)} />
      {others > 0 && (
        <button type="button" onClick={() => setEveryone((v) => !v)} className="mt-2 block text-[11px] text-muted-foreground hover:text-foreground">
          {everyone ? "Show only mine" : `${others} more past due for others on this job — show`}
        </button>
      )}
      {adding && <AddTaskModal jobId={jobId} feed={feed} defaultDue={feed.today} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function DueTodayCard({ jobId, feed }: { jobId: string; feed: JobSummaryFeed }) {
  const [adding, setAdding] = React.useState(false);
  const [all, setAll] = React.useState(false);
  const { busy, error, run } = useTaskActions(jobId);
  const list = feed.tasks.filter((t) => t.due === feed.today).sort((a, b) => Number(b.mine) - Number(a.mine));
  return (
    <Card title="Due Today" action={<CardLink onClick={() => setAdding(true)}>Add</CardLink>}>
      <ErrorNote text={error} />
      {list.length === 0 ? <Empty>Nothing due today.</Empty> : (all ? list : list.slice(0, SHOW)).map((t) => (
        <TaskRow key={t.key} task={t} tag="Today" tone="warn" busy={busy === t.key}
          onDone={() => void run(t, "complete")} onTake={() => void run(t, "assign_me")} />
      ))}
      <MoreToggle total={list.length} open={all} onToggle={() => setAll((v) => !v)} />
      {adding && <AddTaskModal jobId={jobId} feed={feed} defaultDue={feed.today} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function AgendaCard({ jobId, feed }: { jobId: string; feed: JobSummaryFeed }) {
  const [adding, setAdding] = React.useState(false);
  const { busy, error, run } = useTaskActions(jobId);
  // Today's tasks live in Due Today; the agenda is the rest of the week plus
  // every meeting with this job's clients, today included.
  const tasks = feed.tasks.filter((t) => t.due && t.due > feed.today && t.due <= feed.weekEnd);
  const days = [...new Set([...tasks.map((t) => t.due as string), ...feed.meetings.map((m) => m.date)])].sort();
  return (
    <Card title="This Week's Agenda" action={<CardLink onClick={() => setAdding(true)}>Add Agenda Items</CardLink>}>
      <ErrorNote text={error} />
      {days.length === 0 ? <Empty>Nothing scheduled for the next 7 days.</Empty> : (
        <div className="space-y-2">
          {days.map((d) => (
            <div key={d}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d === feed.today ? "Today" : shortDate(d)}</div>
              {feed.meetings.filter((m) => m.date === d).map((m) => (
                <div key={m.id} className="flex items-start gap-2 py-1.5 text-sm">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <Link href="/dashboard/bookings" className="line-clamp-2 hover:text-accent">{m.title}</Link>
                    {m.detail && <div className="truncate text-[11px] text-muted-foreground">{m.detail}</div>}
                  </div>
                  {m.time && <span className="shrink-0 text-[11px] text-muted-foreground">{m.time}</span>}
                </div>
              ))}
              {tasks.filter((t) => t.due === d).map((t) => (
                <TaskRow key={t.key} task={t} tag={null} busy={busy === t.key} onDone={() => void run(t, "complete")} onTake={() => void run(t, "assign_me")} />
              ))}
            </div>
          ))}
        </div>
      )}
      {adding && <AgendaModal jobId={jobId} feed={feed} onClose={() => setAdding(false)} />}
    </Card>
  );
}

// Add work for the job: a new task on its Projects & Tasks board, or pick up
// an open item someone else holds.
function AddTaskModal({ jobId, feed, defaultDue, onClose }: { jobId: string; feed: JobSummaryFeed; defaultDue: string; onClose: () => void }) {
  const refresh = useRefresh();
  const staff = useStaffOptions();
  const [mode, setMode] = React.useState<"new" | "take">("new");
  const [form, setForm] = React.useState({ title: "", due: defaultDue, assignee: feed.viewer.id, priority: "normal", notes: "" });
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const takeable = feed.tasks.filter((t) => !t.mine);
  const staffOptions: ComboOption[] = (staff ?? []).map((s) => ({ value: s.id, label: s.id === feed.viewer.id ? `${s.label} (you)` : s.label, sublabel: s.job_title || s.role }));
  const takeOptions: ComboOption[] = takeable.map((t) => ({
    value: t.key, label: t.title,
    sublabel: [SOURCE_LABEL[t.source], t.assignee ?? "Unassigned", t.due ? `due ${shortDate(t.due)}` : "no date"].join(" · "),
  }));

  async function submit() {
    setBusy(true); setError(null);
    if (mode === "take") {
      const task = takeable.find((t) => t.key === pick);
      if (!task) { setBusy(false); return; }
      const { ok, data } = await postJson(`/api/jobs/${jobId}/summary/tasks`, { action: "assign_me", source: task.source, id: task.id });
      setBusy(false);
      if (!ok) { setError(errText(data, "Couldn't assign that item.")); return; }
    } else {
      const who = staff?.find((s) => s.id === form.assignee);
      const { ok, data } = await postJson("/api/project-manager/schedule", {
        board_id: jobId, type: "task", status: "scheduled", title: form.title.trim(),
        start_date: form.due, end_date: form.due, priority: form.priority,
        assignee: who?.label ?? (form.assignee === feed.viewer.id ? feed.viewer.name : null),
        description: form.notes.trim() || null,
      });
      setBusy(false);
      if (!ok) { setError(errText(data, "Couldn't add the task.")); return; }
    }
    refresh();
    onClose();
  }

  const ready = mode === "take" ? !!pick : !!form.title.trim() && !!form.due;
  return (
    <ModuleModal title="Add a task" onClose={onClose}>
      <div className="space-y-3">
        <ModeTabs value={mode} onChange={setMode} options={[{ value: "new", label: "New task" }, { value: "take", label: `Take an open item (${takeable.length})` }]} />
        <ErrorNote text={error} />
        {mode === "new" ? (
          <>
            <Field label="Task"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to happen?" autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due"><input type="date" className={inputCls} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
              <Field label="Priority">
                <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Assigned to">
              {staff === null ? <div className="text-xs text-muted-foreground">Loading team…</div> : <SearchableSelect options={staffOptions} value={form.assignee} onChange={(v) => setForm({ ...form, assignee: v })} />}
            </Field>
            <Field label="Notes (optional)"><textarea className={cn(inputCls, "h-20 py-2")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <p className="text-[11px] text-muted-foreground">Saved to this job&apos;s <Link href={`/dashboard/jobs/${jobId}/projects`} className="text-accent hover:underline">Projects &amp; Tasks</Link> board.</p>
          </>
        ) : takeable.length === 0 ? <Empty>Every open item on this job is already yours.</Empty> : (
          <Field label="Open item on this job">
            <SearchableSelect options={takeOptions} value={pick} onChange={setPick} placeholder="Search schedule, tasks and punch items…" />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy || !ready}>{busy ? "Saving…" : mode === "take" ? "Assign to me" : "Add task"}</Button>
        </div>
      </div>
    </ModuleModal>
  );
}

// Several agenda items in one go, each saved as a dated task on the board.
function AgendaModal({ jobId, feed, onClose }: { jobId: string; feed: JobSummaryFeed; onClose: () => void }) {
  const refresh = useRefresh();
  const staff = useStaffOptions();
  const blank = () => ({ title: "", date: feed.today, assignee: feed.viewer.id });
  const [rows, setRows] = React.useState([blank(), blank(), blank()]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const staffOptions: ComboOption[] = (staff ?? []).map((s) => ({ value: s.id, label: s.id === feed.viewer.id ? `${s.label} (you)` : s.label }));
  const filled = rows.filter((r) => r.title.trim() && r.date);
  const set = (i: number, patch: Partial<ReturnType<typeof blank>>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit() {
    setBusy(true); setError(null);
    for (const r of filled) {
      const who = staff?.find((s) => s.id === r.assignee);
      const { ok, data } = await postJson("/api/project-manager/schedule", {
        board_id: jobId, type: "task", status: "scheduled", title: r.title.trim(), start_date: r.date, end_date: r.date,
        assignee: who?.label ?? (r.assignee === feed.viewer.id ? feed.viewer.name : null),
      });
      if (!ok) { setBusy(false); setError(errText(data, `Couldn't add “${r.title.trim()}”.`)); refresh(); return; }
    }
    setBusy(false);
    refresh();
    onClose();
  }

  return (
    <ModuleModal title="Add agenda items" onClose={onClose} wide>
      <div className="space-y-3">
        <ErrorNote text={error} />
        <div className="hidden grid-cols-[1fr_9.5rem_11rem_1.5rem] gap-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Item</span><span>Day</span><span>Who</span><span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_9.5rem_11rem_1.5rem] sm:border-0 sm:p-0">
            <input className={inputCls} value={r.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="e.g. Drywall inspection" autoFocus={i === 0} />
            <input type="date" className={inputCls} value={r.date} min={feed.today} onChange={(e) => set(i, { date: e.target.value })} />
            {staff === null ? <div className="self-center text-xs text-muted-foreground">Loading…</div> : <SearchableSelect options={staffOptions} value={r.assignee} onChange={(v) => set(i, { assignee: v })} />}
            <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))} className="self-center text-muted-foreground hover:text-destructive" title="Remove row"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, blank()])} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="h-3.5 w-3.5" /> Add another</button>
        <p className="text-[11px] text-muted-foreground">Each item is saved as a dated task on this job&apos;s Projects &amp; Tasks board and appears here and in the assignee&apos;s Daily Brief.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy || filled.length === 0}>{busy ? "Saving…" : `Add ${filled.length || ""} item${filled.length === 1 ? "" : "s"}`}</Button>
        </div>
      </div>
    </ModuleModal>
  );
}

function ModeTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("flex-1 rounded px-2 py-1.5 text-xs font-medium transition", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Client action items ──────────────────────────────────────────
type ClientOption = { contactId: string; name: string };
const PRIORITY_TONE: Record<ActionItemPriority, "default" | "warning" | "danger"> = { low: "default", normal: "default", high: "warning", urgent: "danger" };

export function ActionItemsCard({ jobId, feed, clients }: { jobId: string; feed: JobSummaryFeed; clients: ClientOption[] }) {
  const refresh = useRefresh();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [all, setAll] = React.useState(false);
  const open = feed.actionItems.filter((a) => a.status === "open" || a.status === "in_progress")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  async function complete(item: ActionItem) {
    setBusy(item.id);
    await postJson(`/api/jobs/${jobId}/action-items/${item.id}`, { status: "completed" }, "PATCH");
    setBusy(null);
    refresh();
  }

  return (
    <Card title="Action Items" action={<CardLink onClick={() => setAdding(true)}>Add</CardLink>}>
      {open.length === 0 ? <Empty>No open client action items.</Empty> : (all ? open : open.slice(0, SHOW)).map((a) => {
        const who = a.assigned_contact ? `${a.assigned_contact.first_name ?? ""} ${a.assigned_contact.last_name ?? ""}`.trim() : null;
        const overdue = a.due_date && a.due_date < feed.today;
        return (
          <div key={a.id} className={cn("group flex items-start gap-2 py-1.5 text-sm", busy === a.id && "opacity-50")}>
            <button type="button" onClick={() => void complete(a)} disabled={busy === a.id} title="Mark complete" className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-accent">
              <Circle className="h-4 w-4 group-hover:hidden" /><Check className="hidden h-4 w-4 group-hover:block" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2">{a.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{who || "Any client on the job"}{a.status === "in_progress" ? " · In progress" : ""}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {a.priority !== "normal" && <Badge tone={PRIORITY_TONE[a.priority]} className="h-5 text-[10px]">{a.priority}</Badge>}
              {a.due_date && <span className={cn("text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>{overdue ? "Was due " : ""}{shortDate(a.due_date)}</span>}
            </div>
          </div>
        );
      })}
      <MoreToggle total={open.length} open={all} onToggle={() => setAll((v) => !v)} />
      <p className="mt-2 text-[11px] text-muted-foreground">Clients see these in their portal. <Link href={`/dashboard/jobs/${jobId}/client-portal`} className="text-accent hover:underline">Manage all</Link></p>
      {adding && <ActionItemsModal jobId={jobId} feed={feed} clients={clients} onClose={() => setAdding(false)} />}
    </Card>
  );
}

type ActionDraft = { title: string; due_date: string; priority: ActionItemPriority; related_entity_type: string | null; related_entity_id: string | null };

function ActionItemsModal({ jobId, feed, clients, onClose }: { jobId: string; feed: JobSummaryFeed; clients: ClientOption[]; onClose: () => void }) {
  const refresh = useRefresh();
  const blank = (): ActionDraft => ({ title: "", due_date: "", priority: "normal", related_entity_type: null, related_entity_id: null });
  const [client, setClient] = React.useState(clients[0]?.contactId ?? "");
  const [rows, setRows] = React.useState<ActionDraft[]>([blank()]);
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const used = new Set(rows.map((r) => r.related_entity_id).filter(Boolean));
  const candidates = feed.actionCandidates.filter((c) => !used.has(c.id));
  const filled = rows.filter((r) => r.title.trim());
  const set = (i: number, patch: Partial<ActionDraft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function addFromRecord(id: string) {
    const c = feed.actionCandidates.find((x) => x.id === id);
    if (!c) return;
    const draft: ActionDraft = { ...blank(), title: c.title, related_entity_type: c.type, related_entity_id: c.id, priority: c.type === "invoice" ? "high" : "normal" };
    // Fill the first empty row before adding a new one.
    setRows((rs) => {
      const empty = rs.findIndex((r) => !r.title.trim());
      return empty >= 0 ? rs.map((r, j) => (j === empty ? draft : r)) : [...rs, draft];
    });
    setPick("");
  }

  async function submit() {
    setBusy(true); setError(null);
    for (const r of filled) {
      const { ok, data } = await postJson(`/api/jobs/${jobId}/action-items`, {
        title: r.title.trim(), due_date: r.due_date || null, priority: r.priority, status: "open",
        assigned_contact_id: client || null, related_entity_type: r.related_entity_type, related_entity_id: r.related_entity_id,
      });
      if (!ok) { setBusy(false); setError(errText(data, `Couldn't add “${r.title.trim()}”.`)); refresh(); return; }
    }
    setBusy(false);
    refresh();
    onClose();
  }

  return (
    <ModuleModal title="Add client action items" onClose={onClose} wide>
      <div className="space-y-3">
        <ErrorNote text={error} />
        <Field label="For client">
          {clients.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No clients on this job yet. Add one in the Clients card so they can see these in their portal; items saved now apply to the job.</div>
          ) : (
            <select className={inputCls} value={client} onChange={(e) => setClient(e.target.value)}>
              {clients.map((c) => <option key={c.contactId} value={c.contactId}>{c.name}</option>)}
              <option value="">Any client on the job</option>
            </select>
          )}
        </Field>
        <Field label="From something waiting on the client">
          {candidates.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nothing on this job is waiting on the client (pending selections, change orders to sign, open invoices).</div>
          ) : (
            <SearchableSelect options={candidates.map((c) => ({ value: c.id, label: c.label }))} value={pick} onChange={addFromRecord} placeholder="Pick a selection, change order or invoice…" />
          )}
        </Field>
        <div className="pt-1 text-xs font-medium text-muted-foreground">Items</div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_9.5rem_7rem_1.5rem] sm:border-0 sm:p-0">
            <input className={inputCls} value={r.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="e.g. Choose cabinet hardware" autoFocus={i === 0} />
            <input type="date" className={inputCls} value={r.due_date} onChange={(e) => set(i, { due_date: e.target.value })} title="Due date (optional)" />
            <select className={inputCls} value={r.priority} onChange={(e) => set(i, { priority: e.target.value as ActionItemPriority })}>
              {(["low", "normal", "high", "urgent"] as ActionItemPriority[]).map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
            <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))} className="self-center text-muted-foreground hover:text-destructive" title="Remove row"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, blank()])} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="h-3.5 w-3.5" /> Add another</button>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy || filled.length === 0}>{busy ? "Saving…" : `Add ${filled.length || ""} item${filled.length === 1 ? "" : "s"}`}</Button>
        </div>
      </div>
    </ModuleModal>
  );
}

// ─── Activity + daily logs ────────────────────────────────────────
export function ActivityCard({ feed }: { feed: JobSummaryFeed }) {
  const [all, setAll] = React.useState(false);
  return (
    <Card title="Recent Activity From Your Team">
      {feed.activity.length === 0 ? <Empty>No recent activity yet.</Empty> : (all ? feed.activity : feed.activity.slice(0, SHOW)).map((a) => (
        <div key={a.key} className="flex items-start gap-2 py-1.5 text-sm">
          <Avatar name={a.actor ?? "?"} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2">{a.text}</div>
            <div className="text-[11px] text-muted-foreground">{a.actor ?? "Someone"} · {relative(a.at)}</div>
          </div>
        </div>
      ))}
      <MoreToggle total={feed.activity.length} open={all} onToggle={() => setAll((v) => !v)} />
    </Card>
  );
}

export function LogsCard({ jobId, feed }: { jobId: string; feed: JobSummaryFeed }) {
  const refresh = useRefresh();
  const [adding, setAdding] = React.useState(false);
  return (
    <Card title="Client Updates / Daily Logs" action={<CardLink onClick={() => setAdding(true)}>Add Daily Log</CardLink>}>
      {feed.logs.length === 0 ? <Empty>No client updates or daily logs yet.</Empty> : feed.logs.map((l) => (
        <Link key={l.key} href={l.href} className="block rounded-md px-1 py-1.5 text-sm transition hover:bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
            {l.kind === "update" ? <Badge tone="info" className="h-5 text-[10px]">Update</Badge> : null}
            {l.clientVisible && <Badge tone="accent" className="h-5 text-[10px]">Client</Badge>}
          </div>
          {l.snippet && <div className="line-clamp-2 text-xs text-muted-foreground">{l.snippet}</div>}
          <div className="text-[11px] text-muted-foreground">{[l.author, l.date ? shortDate(l.date) : null].filter(Boolean).join(" · ")}</div>
        </Link>
      ))}
      <p className="mt-2 text-[11px] text-muted-foreground"><Link href={`/dashboard/jobs/${jobId}/daily-logs`} className="text-accent hover:underline">All daily logs</Link> · <Link href={`/dashboard/jobs/${jobId}/client-portal`} className="text-accent hover:underline">Client updates</Link></p>
      {adding && <AddDailyLogDialog preselect={{ kind: "job", id: jobId }} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />}
    </Card>
  );
}

// ─── Clients / Subs & Vendors ─────────────────────────────────────
type ContactRow = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null; type: string | null };
const CLIENT_TYPES = ["Client", "Customer", "Lead", "Prospect"];
const VENDOR_TYPES = ["Vendor", "Sub Contractor", "Designer"];
const contactName = (c: Pick<ContactRow, "first_name" | "last_name" | "company">) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || "Contact";

/**
 * Link a contact to the job as a client or a sub/vendor: pick an existing
 * contact, or add a new one (which also lands in Contacts).
 */
export function ContactLinkModal({ jobId, kind, existingIds, isFirst, onClose }: {
  jobId: string; kind: "client" | "vendor"; existingIds: Set<string>; isFirst: boolean; onClose: () => void;
}) {
  const refresh = useRefresh();
  const [contacts, setContacts] = React.useState<ContactRow[] | null>(null);
  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [showAll, setShowAll] = React.useState(false);
  const [pick, setPick] = React.useState("");
  const [role, setRole] = React.useState("");
  const [primary, setPrimary] = React.useState(isFirst);
  const [form, setForm] = React.useState({ first_name: "", last_name: "", company: "", phone: "", email: "", type: kind === "client" ? "Client" : "Sub Contractor" });
  const [dupe, setDupe] = React.useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => setContacts([]));
  }, []);

  const types = kind === "client" ? CLIENT_TYPES : VENDOR_TYPES;
  const available = (contacts ?? []).filter((c) => !existingIds.has(c.id));
  const shown = showAll ? available : available.filter((c) => types.includes(c.type ?? ""));
  const options: ComboOption[] = shown.map((c) => ({
    value: c.id,
    label: kind === "vendor" && c.company ? `${c.company}${c.first_name || c.last_name ? ` (${contactName({ ...c, company: null })})` : ""}` : contactName(c),
    sublabel: [c.type, c.email, c.phone].filter(Boolean).join(" · "),
  }));
  const noun = kind === "client" ? "client" : "sub / vendor";

  async function link(contactId: string) {
    const { ok, data } = kind === "client"
      ? await postJson(`/api/jobs/${jobId}/contacts`, { contact_id: contactId, role: "client", is_primary: primary })
      : await postJson(`/api/jobs/${jobId}/vendors`, { vendor_contact_id: contactId, role: role.trim() || null });
    if (!ok) throw new Error(errText(data, `Couldn't add the ${noun}.`));
  }

  async function submit(useExisting?: string) {
    setBusy(true); setError(null);
    try {
      if (useExisting || mode === "existing") {
        await link(useExisting ?? pick);
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: form.first_name.trim(), last_name: form.last_name.trim(),
            company: form.company.trim() || null, phone: form.phone || null,
            email: form.email.trim() || null, type: form.type, status: "active",
            source: "Job summary", confirm_duplicate: !!dupe,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data?.duplicate?.id) {
          setDupe({ id: data.duplicate.id, name: contactName(data.duplicate) });
          throw new Error(data.error || "This looks like a contact you already have.");
        }
        if (!res.ok) throw new Error(errText(data, "Couldn't create the contact."));
        await link(data.id);
      }
      refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const ready = mode === "existing" ? !!pick : !!(form.first_name.trim() || (kind === "vendor" && form.company.trim()));
  return (
    <ModuleModal title={kind === "client" ? "Add client" : "Add sub / vendor"} onClose={onClose}>
      <div className="space-y-3">
        <ModeTabs value={mode} onChange={(m) => { setMode(m); setError(null); setDupe(null); }} options={[{ value: "existing", label: "Choose existing" }, { value: "new", label: "Add new" }]} />
        <ErrorNote text={error} />
        {dupe && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button size="sm" variant="accent" onClick={() => void submit(dupe.id)} disabled={busy}>Use {dupe.name}</Button>
            <span className="text-muted-foreground">or press Add again to create a separate contact.</span>
          </div>
        )}
        {mode === "existing" ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{kind === "client" ? "Contact" : "Company or person"}</span>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-accent hover:underline">{showAll ? `Only ${kind === "client" ? "clients & leads" : "vendors & subs"}` : "Search all contacts"}</button>
            </div>
            {contacts === null ? <div className="py-3 text-center text-sm text-muted-foreground">Loading contacts…</div> : (
              <>
                <SearchableSelect options={options} value={pick} onChange={setPick} placeholder={`Search ${showAll ? "all contacts" : kind === "client" ? "clients & leads" : "vendors & subs"}…`} />
                {options.length === 0 && <div className="text-xs text-muted-foreground">No matches. <button type="button" onClick={() => setShowAll(true)} className="text-accent hover:underline">Search all contacts</button> or <button type="button" onClick={() => setMode("new")} className="text-accent hover:underline">add a new one</button>.</div>}
              </>
            )}
          </>
        ) : (
          <>
            {kind === "vendor" && <Field label="Company"><input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus /></Field>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={kind === "vendor" ? "Contact first name" : "First name"}><input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoFocus={kind === "client"} /></Field>
              <Field label="Last name"><input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><PhoneInput className={inputCls} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            {kind === "vendor" && (
              <Field label="Type">
                <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            )}
            <p className="text-[11px] text-muted-foreground">Also saved to Contacts.</p>
          </>
        )}
        {kind === "vendor" ? (
          <Field label="Role on this job (optional)"><input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Electrical, Framing, Cabinets" /></Field>
        ) : (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} /> Primary client</label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy || !ready}>{busy ? "Saving…" : `Add ${noun}`}</Button>
        </div>
      </div>
    </ModuleModal>
  );
}

/** Small remove control for a linked client / vendor row. */
export function RemoveLink({ url, label }: { url: string; label: string }) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState(false);
  async function remove() {
    if (!(await confirmAction({ title: `Remove ${label} from this job?`, tone: "danger", body: "The contact stays in Contacts; only the link to this job is removed." }))) return;
    setBusy(true);
    await fetch(url, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    refresh();
  }
  return (
    <button type="button" onClick={() => void remove()} disabled={busy} title="Remove from job" className="shrink-0 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
