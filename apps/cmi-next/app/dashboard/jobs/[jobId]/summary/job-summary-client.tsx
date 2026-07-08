"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, MapPin, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobWithRelations, JobStatus } from "@/lib/jobs/types";
import { JobStatusBadge, money, formatDate } from "../../job-ui";
import { JobDetailNav } from "../job-detail-nav";

export function JobSummaryClient({ job }: { job: JobWithRelations }) {
  const clients = job.contacts.filter((c) => c.contact);
  const pms = job.internal_users.filter((u) => u.user);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 pt-4 md:px-6">
        <Link href="/dashboard/jobs" className="text-xs text-muted-foreground hover:text-foreground">← All jobs</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{job.job_name}</h1>
              <JobStatusBadge status={job.status as JobStatus} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{job.job_number ?? "—"}</span>
              {job.full_address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(job.full_address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {job.full_address}
                </a>
              )}
            </div>
          </div>
          <Link href={`/dashboard/jobs/${job.id}/info`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit Job Info</Button></Link>
        </div>
      </div>
      <JobDetailNav jobId={job.id} active="summary" />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Summary card */}
          <div className="space-y-4 lg:col-span-1">
            <Card title="Job">
              <KV label="Status"><JobStatusBadge status={job.status as JobStatus} /></KV>
              <KV label="Job #">{job.job_number ?? "—"}</KV>
              <KV label="Type">{job.job_type?.name ?? "—"}</KV>
              <KV label="Contract">{money(job.contract_price)}</KV>
              <KV label="Address">{job.full_address ?? "—"}</KV>
              <KV label="Clocked in"><span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Time clock not connected</span></KV>
              {(job.related_opportunity_id || job.related_lead_id) && (
                <KV label="Sales">
                  {job.related_opportunity_id && <Link href="/dashboard/sales?tab=opportunities" className="text-accent hover:underline">Opportunity</Link>}
                  {job.related_opportunity_id && job.related_lead_id && " · "}
                  {job.related_lead_id && <Link href="/dashboard/contacts" className="text-accent hover:underline">Lead</Link>}
                </KV>
              )}
            </Card>

            <Card title="Clients" action={<Link href={`/dashboard/jobs/${job.id}/info`} className="text-xs text-accent hover:underline">Add</Link>}>
              {clients.length === 0 ? <Empty>No clients yet.</Empty> : clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 py-1 text-sm">
                  <Avatar name={`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`} />
                  <span>{`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim()}</span>
                  {c.is_primary && <Badge tone="accent">Primary</Badge>}
                </div>
              ))}
            </Card>

            <Card title="Project Managers" action={<Link href={`/dashboard/jobs/${job.id}/info`} className="text-xs text-accent hover:underline">Add</Link>}>
              {pms.length === 0 ? <Empty>No internal users yet.</Empty> : pms.map((u) => (
                <div key={u.id} className="flex items-center gap-2 py-1 text-sm">
                  <Avatar name={u.user?.display_name ?? u.user?.email ?? "?"} />
                  <span>{u.user?.display_name ?? u.user?.email}</span>
                  <span className="text-xs text-muted-foreground">{u.role ?? u.user?.role_slug}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Dashboard cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            <Card title="Past Due For You"><Empty>Nothing past due.</Empty></Card>
            <Card title="Due Today"><Empty>Nothing due today.</Empty></Card>
            <Card title="Action Items"><Empty>No action items.</Empty></Card>
            <Card title="This Week's Agenda"><Empty>No scheduled items. Build the schedule in the Project Manager.</Empty></Card>
            <Card title="Recent Activity From Your Team"><Empty>No recent activity yet.</Empty></Card>
            <Card title="Client Updates / Daily Logs"><Empty>No client updates or daily logs yet.</Empty></Card>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Schedule, tasks, files, daily logs, change orders, and invoices are being connected to jobs. Use the tabs above — implemented areas link to their tools; the rest show what&apos;s coming.
        </p>
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-sm"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{children}</div>;
}
function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">{initials}</span>;
}
