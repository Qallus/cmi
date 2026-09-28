"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock, CalendarDays, CheckCircle2, ClipboardList, FileWarning,
  Loader2, MessagesSquare, Plus, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { InterviewRow, InterviewTemplate } from "@/lib/interviews/data";

type CompanyOption = { id: string; name: string; trades: string[] };
type StaffOption = { id: string; name: string };

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  invited: "bg-info/15 text-info",
  scheduled: "bg-info/15 text-info",
  confirmed: "bg-info/15 text-info",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  follow_up: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  awaiting_documents: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  not_moving_forward: "bg-destructive/15 text-destructive",
  reschedule: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-destructive/15 text-destructive",
};

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export function InterviewsClient({
  initialInterviews, templates, stats, companies, staff, meId, canManageTemplates, isSuperAdmin,
}: {
  initialInterviews: InterviewRow[];
  templates: InterviewTemplate[];
  stats: Record<string, number>;
  companies: CompanyOption[];
  staff: StaffOption[];
  meId: string;
  canManageTemplates: boolean;
  isSuperAdmin: boolean;
}) {
  const [rows, setRows] = React.useState(initialInterviews);
  const [status, setStatus] = React.useState("all");
  const [interviewer, setInterviewer] = React.useState("");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (interviewer) params.set("interviewer", interviewer);
    if (q) params.set("q", q);
    const res = await fetch(`/api/interviews?${params}`);
    if (res.ok) setRows(await res.json());
    setBusy(false);
  }, [status, interviewer, q]);

  // Filters are a different query; the first render already has the server's.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Qualification</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Interviews</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Structured qualification meetings. What gets answered here lands on the partner&apos;s
            profile, so the Directory can find them by it later.
          </p>
        </div>
        <div className="flex gap-2">
          {canManageTemplates && (
            <Link
              href="/dashboard/interviews/templates"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium transition hover:bg-muted"
            >
              <ClipboardList className="h-4 w-4" /> Templates
            </Link>
          )}
          <Button variant="accent" onClick={() => setStarting(true)}>
            <Plus className="h-4 w-4" /> New interview
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={CalendarClock} label="Upcoming" value={stats.upcoming ?? 0} tone="text-info" />
        <Stat icon={CalendarDays} label="This week" value={stats.this_week ?? 0} tone="text-info" />
        <Stat icon={MessagesSquare} label="In progress" value={stats.in_progress ?? 0} tone="text-amber-600" />
        <Stat icon={FileWarning} label="Open follow-ups" value={stats.open_followups ?? 0} tone="text-destructive" />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completed ?? 0} tone="text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search interviews…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Still open</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="follow_up">Follow-up</option>
          <option value="awaiting_documents">Awaiting documents</option>
        </Select>
        <Select className="w-auto" value={interviewer} onChange={(e) => setInterviewer(e.target.value)}>
          <option value="">Anyone</option>
          <option value={meId}>Mine</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No interviews yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start one from a template. If the partner has already applied, their answers are
            filled in for you, so the meeting is spent on what&apos;s missing.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Interview</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Interviewer</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Follow-ups</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border transition hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link href={`/dashboard/interviews/${r.id}`} className="font-medium hover:text-accent">
                      {r.title}
                    </Link>
                    {r.template_name && <div className="text-[11px] text-muted-foreground">{r.template_name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.company_name || r.contact_name || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.interviewer_name || "Unassigned"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{when(r.scheduled_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${r.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{r.progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[r.status] ?? "bg-muted")}>
                      {pretty(r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {r.open_followups > 0
                      ? <span className="text-amber-700 dark:text-amber-300">{r.open_followups} open</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {starting && (
        <NewInterviewDialog
          templates={templates} companies={companies} staff={staff} meId={meId}
          onClose={() => setStarting(false)}
        />
      )}
      {isSuperAdmin && null}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof MessagesSquare; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function NewInterviewDialog({
  templates, companies, staff, meId, onClose,
}: {
  templates: InterviewTemplate[];
  companies: CompanyOption[];
  staff: StaffOption[];
  meId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [companyQuery, setCompanyQuery] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [interviewerId, setInterviewerId] = React.useState(meId);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [meetingType, setMeetingType] = React.useState("video_meeting");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId) ?? null;

  // Suggest partners whose trade matches the template, since that is nearly
  // always who the interview is for.
  const matches = React.useMemo(() => {
    const needle = companyQuery.trim().toLowerCase();
    const scored = companies.filter((c) => !needle || c.name.toLowerCase().includes(needle));
    if (!template?.trade) return scored.slice(0, 30);
    const trade = template.trade;
    return [...scored].sort((a, b) => Number(b.trades.includes(trade)) - Number(a.trades.includes(trade))).slice(0, 30);
  }, [companies, companyQuery, template]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function start() {
    setBusy(true); setError(null);
    const res = await fetch("/api/interviews", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        company_id: companyId || null,
        interviewer_id: interviewerId || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        meeting_type: meetingType,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not start the interview."); setBusy(false); return; }
    router.push(`/dashboard/interviews/${json.id}`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="New interview" className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">New interview</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Template</span>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            {template?.description && <span className="block text-xs text-muted-foreground">{template.description}</span>}
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Company</span>
            <Input placeholder="Search partners…" value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} />
            <div className="max-h-44 overflow-y-auto rounded-md border border-border">
              <button
                type="button" onClick={() => setCompanyId("")}
                className={cn("flex w-full items-center px-3 py-1.5 text-left text-sm transition hover:bg-muted", !companyId && "bg-muted font-medium")}
              >
                No company yet
              </button>
              {matches.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setCompanyId(c.id)}
                  className={cn("flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-muted", companyId === c.id && "bg-muted font-medium")}
                >
                  <span className="truncate">{c.name}</span>
                  {template?.trade && c.trades.includes(template.trade) && (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">{template.trade}</span>
                  )}
                </button>
              ))}
            </div>
            {companyId && (
              <p className="text-xs text-muted-foreground">
                Anything already on their profile will be filled in, so you can confirm it rather than ask again.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Interviewer</span>
              <Select value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Meeting type</span>
              <Select value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                <option value="video_meeting">Video</option>
                <option value="phone_call">Phone</option>
                <option value="in_person">In person</option>
                <option value="onsite">Site walk</option>
              </Select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">When</span>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <span className="block text-xs text-muted-foreground">Leave blank to start straight away.</span>
          </label>

          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={busy || !templateId} onClick={() => void start()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Start
          </Button>
        </div>
      </div>
    </div>
  );
}
