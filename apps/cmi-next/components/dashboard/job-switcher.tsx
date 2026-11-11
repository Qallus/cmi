"use client";

// Top bar, right of "CMI Dashboard": a menu of every job, with search and a
// multi-select filter (Status / Type / PM). On a job's page it shows that job
// and switching keeps you on the same tab (Schedule → the other job's Schedule).
import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";
import { MobileSubNavMultiSelect, type MultiSelectGroup } from "@/components/ui/mobile-sub-nav";

type JobRow = {
  id: string; job_number: string | null; job_name: string | null; status: JobStatus;
  type_name: string | null; project_managers: string[] | null; archived_at: string | null; job_color: string | null;
};

const FILTER_KEY = "cmi.jobSwitcher.filters";
const JOB_PATH = /^\/dashboard\/jobs\/([0-9a-f-]{36})(?:\/([^/?#]+))?/;

export function JobSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const m = pathname.match(JOB_PATH);
  const currentId = m?.[1] ?? null;
  const tab = m?.[2] ?? "summary";

  const [open, setOpen] = React.useState(false);
  const [jobs, setJobs] = React.useState<JobRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [pms, setPms] = React.useState<string[]>([]);
  const [activeOnly, setActiveOnly] = React.useState(true);
  const searchRef = React.useRef<HTMLInputElement>(null);
  // The menu renders on <body> (so no page's sticky header can cover it), placed under the button.
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => { const r = buttonRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 392)) }); };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  // Remember the filter per browser.
  React.useEffect(() => {
    try {
      const s = JSON.parse(window.localStorage.getItem(FILTER_KEY) ?? "null") as { status?: string[]; types?: string[]; pms?: string[]; activeOnly?: boolean } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-browser preference after mount
      if (s) { setStatus(s.status ?? []); setTypes(s.types ?? []); setPms(s.pms ?? []); setActiveOnly(s.activeOnly ?? true); }
    } catch { /* storage unavailable */ }
  }, []);
  React.useEffect(() => {
    try { window.localStorage.setItem(FILTER_KEY, JSON.stringify({ status, types, pms, activeOnly })); } catch { /* storage unavailable */ }
  }, [status, types, pms, activeOnly]);

  // The list: loaded on first open (and once on a job page, for the button's label).
  const load = React.useCallback(() => {
    fetch("/api/jobs").then(async (r) => {
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Could not load jobs."); setJobs([]); return; }
      setJobs((Array.isArray(d) ? d : d.jobs ?? []) as JobRow[]);
    }).catch(() => { setError("Could not load jobs."); setJobs([]); });
  }, []);
  React.useEffect(() => { if ((open || currentId) && jobs === null) load(); }, [open, currentId, jobs, load]);
  React.useEffect(() => { if (open) window.setTimeout(() => searchRef.current?.focus(), 30); else setQ(""); }, [open]);
  React.useEffect(() => { setOpen(false); }, [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const all = jobs ?? [];
  const current = currentId ? all.find((j) => j.id === currentId) ?? null : null;
  const typeOptions = [...new Set(all.map((j) => j.type_name).filter((t): t is string => !!t))].sort();
  const pmOptions = [...new Set(all.flatMap((j) => j.project_managers ?? []))].sort((a, b) => a.localeCompare(b));
  const statusOptions = [...new Set(all.map((j) => j.status))].filter((s) => JOB_STATUS_META[s]);
  const groups: MultiSelectGroup[] = [
    { key: "status", label: "Status", options: statusOptions.map((s) => ({ value: s, label: JOB_STATUS_META[s].label })), selected: status, onChange: setStatus },
    ...(typeOptions.length ? [{ key: "type", label: "Type", options: typeOptions.map((t) => ({ value: t, label: t })), selected: types, onChange: setTypes }] : []),
    ...(pmOptions.length ? [{ key: "pm", label: "Project manager", options: pmOptions.map((p) => ({ value: p, label: p })), selected: pms, onChange: setPms }] : []),
  ];
  const filtering = status.length + types.length + pms.length > 0 || !activeOnly;

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter((j) => {
    if (j.archived_at) return false;
    if (activeOnly && !status.length && !JOB_STATUS_META[j.status]?.open) return false;
    if (status.length && !status.includes(j.status)) return false;
    if (types.length && !types.includes(j.type_name ?? "")) return false;
    if (pms.length && !(j.project_managers ?? []).some((p) => pms.includes(p))) return false;
    const hay = `${j.job_number ?? ""} ${j.job_name ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => (a.job_name ?? "").localeCompare(b.job_name ?? ""));

  const href = (id: string) => `/dashboard/jobs/${id}/${tab}`;
  const label = current?.job_name ?? (currentId ? "This job" : "Jobs");

  return (
    <div className="relative">
      <button ref={buttonRef} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" title="Go to a job"
        className={cn("inline-flex h-8 max-w-[16rem] items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm transition hover:text-foreground xl:max-w-[22rem]",
          open ? "border-accent text-foreground" : "border-border text-muted-foreground", current && "text-foreground")}>
        {current?.job_color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current.job_color }} /> : <Briefcase className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate font-medium">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition", open && "rotate-180")} />
      </button>
      {open && pos ? createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Jobs" style={{ top: pos.top, left: pos.left }} className="fixed z-[91] flex max-h-[min(70vh,560px)] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-card shadow-xl">
            <div className="space-y-2 border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs by name or number…"
                  onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) { setOpen(false); router.push(href(shown[0].id)); }; }}
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-sm outline-none focus:border-accent" />
                {q ? <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button> : null}
              </div>
              <MobileSubNavMultiSelect groups={groups} placeholder="Filter: Status, Type, PM" />
              <div className="flex items-center justify-between px-0.5 text-xs">
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" /> Active jobs only
                </label>
                {filtering ? <button type="button" onClick={() => { setStatus([]); setTypes([]); setPms([]); setActiveOnly(true); }} className="text-accent hover:underline">Reset</button> : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {jobs === null ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…</div>
              ) : error ? (
                <div className="px-3 py-4 text-sm text-destructive">{error}</div>
              ) : shown.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No jobs match.</div>
              ) : shown.map((j) => (
                <Link key={j.id} href={href(j.id)} onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition hover:bg-muted", j.id === currentId && "bg-accent/10")}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" style={j.job_color ? { background: j.job_color, borderColor: j.job_color } : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{j.job_name ?? "Untitled job"}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{[JOB_STATUS_META[j.status]?.label, j.type_name, (j.project_managers ?? []).join(", ")].filter(Boolean).join(" · ")}</span>
                  </span>
                  {j.id === currentId ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>{jobs ? `${shown.length} of ${all.filter((j) => !j.archived_at).length} jobs` : ""}</span>
              <Link href="/dashboard/jobs" onClick={() => setOpen(false)} className="text-accent hover:underline">All jobs →</Link>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </div>
  );
}
