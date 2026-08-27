"use client";

// Shared chrome for a single-job module page (Change Orders, Invoices, Daily
// Logs, Files): back link, title + action, the job sub-nav, and a scroll body.
import * as React from "react";
import Link from "next/link";
import { JobDetailNav } from "./job-detail-nav";

export function JobModuleShell({
  jobId, jobName, active, title, action, children,
}: {
  jobId: string; jobName: string; active: string; title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={jobId} active={active} action={action} />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/jobs/${jobId}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {jobName}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

// Small shared form/table atoms used by the module clients.
export const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`flex flex-col gap-1 ${className ?? ""}`}><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}

export function ModuleModal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}
