"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock, CalendarDays, CalendarRange, CheckCircle2, ClipboardList,
  FileWarning, LayoutGrid, List, Loader2, MessagesSquare, Plus, Rows3, Search,
  Table as TableIcon, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { InterviewRow, InterviewTemplate } from "@/lib/interviews/data";
import { CompanyPicker, type CompanyOption } from "./company-picker";
import {
  InterviewCalendar, InterviewCards, InterviewList, InterviewTable, type ViewMode,
} from "./interview-views";

export type { CompanyOption };
export type StaffOption = { id: string; name: string };

const VIEW_KEY = "cmi-interviews-view";

const VIEWS: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: Rows3 },
  { value: "table", label: "Table", icon: TableIcon },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "calendar", label: "Calendar", icon: CalendarRange },
];

/**
 * The Interviews tab inside Trade Partners.
 *
 * Its own data loads on first open rather than with the page, so the three
 * other tabs are not slowed down for people who never come here. Companies and
 * staff come in as props because Trade Partners already has them.
 */
export function InterviewsPanel({
  companies: initialCompanies, staff, meId, canManageTemplates, isSuperAdmin,
}: {
  companies: CompanyOption[];
  staff: StaffOption[];
  meId: string;
  canManageTemplates: boolean;
  isSuperAdmin: boolean;
}) {
  const [companies, setCompanies] = React.useState(initialCompanies);
  const [rows, setRows] = React.useState<InterviewRow[] | null>(null);
  const [templates, setTemplates] = React.useState<InterviewTemplate[]>([]);
  const [stats, setStats] = React.useState<Record<string, number>>({});
  const [view, setView] = React.useState<ViewMode>("list");
  const [status, setStatus] = React.useState("all");
  const [interviewer, setInterviewer] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(VIEW_KEY); } catch { /* private window */ }
    if (!saved || !VIEWS.some((v) => v.value === saved)) return;
    // eslint-disable-next-line -- one-time restore of saved preference on mount
    setView(saved as ViewMode);
  }, []);

  const pickView = React.useCallback((next: ViewMode) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* fine */ }
  }, []);

  // The first load. Inline rather than a called helper so the await is plainly
  // before every setState, which is what makes this legal in an effect.
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch("/api/interviews/overview");
      const json = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok) { setError(json.error ?? "Could not load interviews."); setRows([]); return; }
      setRows(json.interviews ?? []);
      setTemplates(json.templates ?? []);
      setStats(json.stats ?? {});
    })();
    return () => { alive = false; };
  }, []);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (interviewer) params.set("interviewer", interviewer);
    if (showArchived) params.set("archived", "1");
    if (q) params.set("q", q);
    const res = await fetch(`/api/interviews?${params}`);
    if (res.ok) setRows(await res.json());
    setBusy(false);
  }, [status, interviewer, showArchived, q]);

  // Filters are a different query. Skips the first run, which `load` covered.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(t);
  }, [refresh]);

  if (rows === null) {
    return (
      <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading interviews…
      </p>
    );
  }

  const shared = { rows, isSuperAdmin, onChanged: () => void refresh() };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={CalendarClock} label="Upcoming" value={stats.upcoming ?? 0} tone="text-info" />
        <Stat icon={CalendarDays} label="This week" value={stats.this_week ?? 0} tone="text-info" />
        <Stat icon={MessagesSquare} label="In progress" value={stats.in_progress ?? 0} tone="text-amber-600" />
        <Stat icon={FileWarning} label="Open follow-ups" value={stats.open_followups ?? 0} tone="text-destructive" />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completed ?? 0} tone="text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.value} type="button" onClick={() => pickView(v.value)}
              aria-label={`${v.label} view`} aria-pressed={view === v.value} title={v.label}
              className={cn(
                "rounded p-1.5 transition",
                view === v.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <v.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="relative min-w-[160px] flex-1">
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
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Archived
        </label>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{showArchived ? "Nothing archived" : "No interviews yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {showArchived
              ? "Interviews you archive are kept here, with every answer and follow-up, and can be restored."
              : "Start one from a template. If the partner has already applied, their answers are filled in for you, so the meeting is spent on what's missing."}
          </p>
        </div>
      ) : view === "table" ? (
        <InterviewTable {...shared} />
      ) : view === "cards" ? (
        <InterviewCards {...shared} />
      ) : view === "calendar" ? (
        <InterviewCalendar {...shared} />
      ) : (
        <InterviewList {...shared} />
      )}

      {starting && (
        <NewInterviewDialog
          templates={templates} companies={companies} staff={staff} meId={meId}
          onCompanyCreated={(c) => setCompanies((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setStarting(false)}
        />
      )}
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
  templates, companies, staff, meId, onClose, onCompanyCreated,
}: {
  templates: InterviewTemplate[];
  companies: CompanyOption[];
  staff: StaffOption[];
  meId: string;
  onClose: () => void;
  onCompanyCreated: (c: CompanyOption) => void;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [companyId, setCompanyId] = React.useState("");
  const [interviewerId, setInterviewerId] = React.useState(meId);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [meetingType, setMeetingType] = React.useState("video_meeting");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId) ?? null;

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
      <div role="dialog" aria-modal="true" aria-label="New interview" className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
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

          <CompanyPicker
            companies={companies}
            value={companyId}
            onChange={setCompanyId}
            preferTrade={template?.trade}
            onCreated={(c) => { onCompanyCreated(c); setCompanyId(c.id); }}
          />

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
