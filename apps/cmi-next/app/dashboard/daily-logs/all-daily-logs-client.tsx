"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Camera, Check, Clock, CloudSun, Eye, NotebookPen, Plus, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddDailyLogDialog } from "@/components/dashboard/add-daily-log";
import type { DailyLogWithJob } from "@/lib/daily-logs/data";

const fmtDay = (ymd: string) =>
  new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });

// Every log belongs to a Job or a Pre-Con opportunity; this is the key both share.
const targetKey = (l: DailyLogWithJob) => (l.job_id ? `job:${l.job_id}` : `opportunity:${l.opportunity_id}`);
const targetLabel = (l: DailyLogWithJob) =>
  l.job_id ? [l.job_number, l.job_name].filter(Boolean).join(" · ") || "Job"
    : `Pre-Con · ${[l.opportunity_number, l.opportunity_name].filter(Boolean).join(" · ") || "Opportunity"}`;
const targetHref = (l: DailyLogWithJob) => (l.job_id ? `/dashboard/jobs/${l.job_id}/daily-logs` : `/dashboard/sales/${l.opportunity_id}`);

export function AllDailyLogsClient({ logs }: { logs: DailyLogWithJob[] }) {
  const router = useRouter();
  const params = useSearchParams();
  // ?new=1 (the mobile menu's Daily Logs button) opens the form straight away.
  const [adding, setAdding] = React.useState(params.get("new") === "1");
  const [flash, setFlash] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [job, setJob] = React.useState("");
  const [delaysOnly, setDelaysOnly] = React.useState(false);

  const jobs = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of logs) if (!seen.has(targetKey(l))) seen.set(targetKey(l), targetLabel(l));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  }, [logs]);

  const needle = q.trim().toLowerCase();
  const filtered = logs.filter((l) =>
    (!job || targetKey(l) === job) &&
    (!delaysOnly || !!l.delays?.trim()) &&
    (!needle || [l.title, l.notes, l.delays, l.visitors, l.job_name, l.job_number, l.opportunity_name, l.opportunity_number, ...(l.crew ?? [])].some((v) => (v ?? "").toLowerCase().includes(needle))),
  );

  // Grouped by day, newest first (the query already sorts).
  const days: { day: string; logs: DailyLogWithJob[] }[] = [];
  for (const l of filtered) {
    const day = l.log_date.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.logs.push(l); else days.push({ day, logs: [l] });
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Jobs</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Daily Logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every Job and Pre-Con daily log in one place.</p>
          </div>
          <Button variant="accent" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add Log</Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, crew, delays…"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <select value={job} onChange={(e) => setJob(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent">
            <option value="">All Jobs & Pre-Con ({jobs.length})</option>
            {jobs.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={delaysOnly} onChange={(e) => setDelaysOnly(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Only logs with delays
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} log{filtered.length === 1 ? "" : "s"}</span>
        </div>

        {flash && <p className="flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-2 text-sm font-medium text-accent"><Check className="h-4 w-4" /> {flash}</p>}

        {days.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <NotebookPen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{logs.length ? "No logs match" : "No daily logs yet"}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {logs.length ? "Try a different search or job." : "Add the first one, or add logs from a job's Daily Logs tab."}
            </p>
            {!logs.length && <Button className="mt-4" variant="accent" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add Log</Button>}
          </div>
        ) : days.map(({ day, logs: dayLogs }) => (
          <section key={day}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{fmtDay(day)}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {dayLogs.map((l) => (
                <Link key={l.id} href={targetHref(l)}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:border-accent/40 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-accent">{targetLabel(l)}</div>
                      <div className="mt-0.5 font-medium">{l.title || "Daily log"}</div>
                    </div>
                    {l.client_visible && <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Eye className="h-3 w-3" /> Client visible</span>}
                  </div>
                  {l.notes && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{l.notes}</p>}
                  {l.delays?.trim() && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {l.delays}
                    </p>
                  )}
                  <div className={cn("mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground")}>
                    {(l.weather || l.temperature) && <span className="flex items-center gap-1"><CloudSun className="h-3.5 w-3.5" /> {[l.weather, l.temperature].filter(Boolean).join(" · ")}</span>}
                    {l.hours_worked != null && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {l.hours_worked} hrs</span>}
                    {(l.crew?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {l.crew!.length} crew</span>}
                    {(l.photos?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> {l.photos!.length} photo{l.photos!.length === 1 ? "" : "s"}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      {adding && (
        <AddDailyLogDialog
          onClose={() => { setAdding(false); if (params.get("new")) router.replace("/dashboard/daily-logs"); }}
          onSaved={(n) => {
            setAdding(false);
            setFlash(n > 1 ? `Log saved to ${n} Jobs / Pre-Con.` : "Log saved.");
            window.setTimeout(() => setFlash(null), 4000);
            if (params.get("new")) router.replace("/dashboard/daily-logs");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
