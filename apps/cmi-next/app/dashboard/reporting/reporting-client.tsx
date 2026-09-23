"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileBarChart, Plus, Upload, Loader2, CalendarDays, ListChecks,
  History, ArrowRight, AlertTriangle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ChangeGroup, OpenActionItem, ReportSummary } from "@/lib/reporting/types";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

type Tab = "reports" | "changes" | "actions";

export function ReportingClient({
  initialReports, initialActions, canWrite,
}: {
  initialReports: ReportSummary[];
  initialActions: OpenActionItem[];
  canWrite: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("reports");
  const [reports, setReports] = React.useState(initialReports);
  const [modal, setModal] = React.useState<"new" | "import" | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/reporting/reports");
    if (res.ok) setReports(await res.json());
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Reporting</h1>
          <p className="text-sm text-muted-foreground">
            Weekly workload meetings, what moved since last week, and who owes what.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setModal("import")}><Upload className="h-4 w-4" /> Import a past meeting</Button>
            <Button variant="accent" onClick={() => setModal("new")}><Plus className="h-4 w-4" /> New report</Button>
          </div>
        )}
      </header>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {([
          ["reports", "Reports", FileBarChart],
          ["changes", "Changes since…", History],
          ["actions", "Action items", ListChecks],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 transition",
              tab === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "reports" && <ReportList reports={reports} />}
      {tab === "changes" && <ChangesView reports={reports} />}
      {tab === "actions" && <ActionsView initial={initialActions} />}

      {modal === "new" && <NewReportModal onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "import" && <ImportModal onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────────────────────

function ReportList({ reports }: { reports: ReportSummary[] }) {
  if (reports.length === 0) {
    return (
      <Empty
        icon={FileBarChart}
        title="No reports yet"
        body="Create one for this week's meeting, or import a past meeting document to bring your history across."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            href={`/dashboard/reporting/${report.id}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-accent"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{report.title}</span>
                {report.status === "final" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Final</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(report.meeting_date)}</span>
                <span>{report.item_count} items</span>
                <span>{report.open_action_count} open action items</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewReportModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const router = useRouter();
  const [date, setDate] = React.useState(today());
  const [title, setTitle] = React.useState("");
  const [populate, setPopulate] = React.useState(true);
  const [carry, setCarry] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    setBusy(true); setError(null);
    const res = await fetch("/api/reporting/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_date: date, title, populate, carry_forward: carry }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't create the report."); return; }
    await onDone();
    router.push(`/dashboard/reporting/${json.id}`);
  }

  return (
    <Modal title="New weekly report" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Meeting date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Title"><Input value={title} placeholder={`Weekly Workload Meeting — ${date}`} onChange={(e) => setTitle(e.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={populate} onChange={(e) => setPopulate(e.target.checked)} />
          <span>
            Fill it from the system
            <span className="block text-xs text-muted-foreground">Active jobs, warranty jobs, pre-con budgets and open leads, filed into the right sections.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
          <span>
            Carry forward open action items
            <span className="block text-xs text-muted-foreground">Anything still open from the previous meeting reappears on this agenda.</span>
          </span>
        </label>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={() => void create()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
        </Button>
      </ModalActions>
    </Modal>
  );
}

type Preview = { meeting_date: string | null; sections: { key: string; title: string; items: number; actions: number; sample: string[] }[] };

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [date, setDate] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send(isPreview: boolean) {
    setBusy(true); setError(null);
    let res: Response;
    if (file) {
      const form = new FormData();
      form.set("file", file);
      if (date) form.set("meeting_date", date);
      form.set("preview", String(isPreview));
      res = await fetch("/api/reporting/import", { method: "POST", body: form });
    } else {
      res = await fetch("/api/reporting/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, meeting_date: date || undefined, preview: isPreview }),
      });
    }
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't read that document."); return; }
    if (isPreview) {
      setPreview(json as Preview);
      if (!date && json.meeting_date) setDate(json.meeting_date);
      return;
    }
    await onDone();
    router.push(`/dashboard/reporting/${json.report_id}`);
  }

  const ready = !!file || text.trim().length > 0;

  return (
    <Modal title="Import a past meeting" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Paste the meeting outline, or upload the .pdf / .txt. Pasting from Word keeps the text cleanest —
          PDF extraction can garble some characters, which you can fix after importing.
        </p>

        <Field label="Upload a file">
          <input
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </Field>

        {!file && (
          <Field label="…or paste the outline">
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setPreview(null); }}
              className="min-h-[160px] font-mono text-xs"
              placeholder={"Active Project Status\n• 25_062_ Olson Casita\n  o Project Status: In Progress\n  o Issues/Action Items:\n    § Photographs – need to be scheduled"}
            />
          </Field>
        )}

        <Field label="Meeting date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

        {preview && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Found</p>
            <ul className="space-y-1.5 text-sm">
              {preview.sections.map((s) => (
                <li key={s.key}>
                  <span className="font-medium">{s.title}</span>
                  <span className="text-muted-foreground"> — {s.items} items, {s.actions} action items</span>
                  {s.sample.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{s.sample.join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="outline" onClick={() => void send(true)} disabled={busy || !ready}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Preview
        </Button>
        <Button variant="accent" onClick={() => void send(false)} disabled={busy || !ready}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ─── Changes since ─────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  stage: "Stage", status: "Status", estimated_value: "Value", probability: "Probability",
  target_start_date: "Target start", expected_close_date: "Expected close", next_action: "Next action",
  next_action_due: "Next action due", owner_id: "Owner", lost_reason: "Lost reason",
  projected_completion_date: "Projected completion", actual_completion_date: "Actual completion",
  current_phase: "Phase", next_milestone: "Next milestone", contract_price: "Contract price",
  completed_at: "Completed", assigned_to: "Assignee", due_at: "Due", title: "Title",
};

function ChangesView({ reports }: { reports: ReportSummary[] }) {
  const lastMeeting = reports.find((r) => r.meeting_date <= today())?.meeting_date;
  const [since, setSince] = React.useState(lastMeeting ?? daysAgo(7));
  // Keyed by the window it was loaded for, so "loading" is derived rather than
  // a second piece of state the effect has to set.
  const [loaded, setLoaded] = React.useState<{ since: string; groups: ChangeGroup[] } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/reporting/changes?since=${encodeURIComponent(since)}`);
      const groups = res.ok ? ((await res.json()) as ChangeGroup[]) : [];
      if (!cancelled) setLoaded({ since, groups });
    })();
    return () => { cancelled = true; };
  }, [since]);

  const busy = loaded?.since !== since;
  const groups = loaded?.since === since ? loaded.groups : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <Field label="Changes since"><Input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></Field>
        <div className="flex gap-2">
          {[["Last meeting", lastMeeting], ["7 days", daysAgo(7)], ["14 days", daysAgo(14)], ["30 days", daysAgo(30)]]
            .filter(([, value]) => !!value)
            .map(([label, value]) => (
              <Button key={label as string} variant="outline" size="sm" onClick={() => setSince(value as string)}>{label}</Button>
            ))}
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {groups && groups.length === 0 && (
        <Empty
          icon={History}
          title="Nothing changed in that window"
          body="The change log starts from the moment Reporting was installed, so earlier edits aren't in it."
        />
      )}

      <ul className="space-y-2">
        {(groups ?? []).map((group) => (
          <li key={`${group.table_name}:${group.record_id}`} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              {group.href
                ? <Link href={group.href} className="font-medium text-accent hover:underline">{group.record_label}</Link>
                : <span className="font-medium">{group.record_label}</span>}
              <span className="text-xs text-muted-foreground">{group.changes.length} changes{group.notes_added ? ` · ${group.notes_added} notes` : ""}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {group.changes.slice(0, 12).map((change) => (
                <li key={change.id} className="text-muted-foreground">
                  {change.op === "insert" ? (
                    <span>Created</span>
                  ) : change.op === "delete" ? (
                    <span>Deleted</span>
                  ) : (
                    <span>
                      <span className="text-foreground">{FIELD_LABELS[change.field ?? ""] ?? change.field}</span>
                      {": "}
                      <span className="line-through">{change.old_value || "—"}</span>
                      {" → "}
                      <span className="text-foreground">{change.new_value || "—"}</span>
                    </span>
                  )}
                  <span className="text-xs"> · {new Date(change.changed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {change.changed_by_name && <span className="text-xs"> · {change.changed_by_name}</span>}
                </li>
              ))}
              {group.changes.length > 12 && (
                <li className="text-xs text-muted-foreground">+{group.changes.length - 12} more</li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Action items by person ────────────────────────────────────────────────

function ActionsView({ initial }: { initial: OpenActionItem[] }) {
  const [filter, setFilter] = React.useState("all");

  const owners = React.useMemo(() => {
    const names = new Set<string>();
    for (const action of initial) names.add(action.owner_name || "Unassigned");
    return [...names].sort();
  }, [initial]);

  const shown = React.useMemo(() => {
    const list = filter === "all"
      ? initial
      : filter === "overdue"
        ? initial.filter((a) => a.overdue)
        : initial.filter((a) => (a.owner_name || "Unassigned") === filter);
    return [...list].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }, [initial, filter]);

  if (initial.length === 0) {
    return <Empty icon={ListChecks} title="No open action items" body="Action items added to a weekly report show up here, grouped by who owns them." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <Field label="Show">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Everyone ({initial.length})</option>
            <option value="overdue">Overdue ({initial.filter((a) => a.overdue).length})</option>
            {owners.map((name) => (
              <option key={name} value={name}>{name} ({initial.filter((a) => (a.owner_name || "Unassigned") === name).length})</option>
            ))}
          </Select>
        </Field>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {shown.map((action) => (
          <li key={action.id} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="text-sm">{action.body}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <Link href={`/dashboard/reporting/${action.report_id}`} className="hover:underline">
                  {[action.job_number, action.item_title].filter(Boolean).join("_")}
                </Link>
                {" · "}{fmtDate(action.meeting_date)}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs">
              <p className="font-medium">{action.owner_name || "Unassigned"}</p>
              {action.due_date && (
                <p className={cn("mt-0.5", action.overdue ? "text-destructive" : "text-muted-foreground")}>
                  {action.overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  due {fmtDate(action.due_date)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Empty({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className={cn("max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
