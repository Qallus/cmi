"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeDollarSign, CalendarClock, Clock, Contact, FileSignature, FileText, HardHat, LayoutGrid, MapPin, MessagesSquare, Pencil, ReceiptText, ScrollText, SlidersHorizontal, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobWithRelations, JobStatus, JobInternalUser, JobStats } from "@/lib/jobs/types";
import { JobStatusBadge, money, formatDate } from "../../job-ui";
import { JobDetailNav } from "../job-detail-nav";

type StaffOption = { id: string; label: string; email: string; role: string; job_title: string };

export function JobSummaryClient({ job, stats }: { job: JobWithRelations; stats: JobStats }) {
  const clients = job.contacts.filter((c) => c.contact);
  const [pms, setPms] = React.useState<JobInternalUser[]>(job.internal_users.filter((u) => u.user));
  const [manualPm, setManualPm] = React.useState<string | null>(job.project_manager);
  const [pmModal, setPmModal] = React.useState(false);

  async function addTeamPm(staff: StaffOption) {
    const res = await fetch(`/api/jobs/${job.id}/internal-users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_user_id: staff.id, role: "Project Manager" }) });
    if (res.ok) { const created = await res.json(); setPms((p) => [...p, created]); setPmModal(false); }
  }
  async function addManualPm(text: string) {
    const res = await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_manager: text }) });
    if (res.ok) { setManualPm(text); setPmModal(false); }
  }
  async function clearManualPm() {
    await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_manager: null }) }).catch(() => {});
    setManualPm(null);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Single-row job header: back · tabs · Edit */}
      <JobDetailNav
        jobId={job.id}
        active="summary"
        action={<Link href={`/dashboard/jobs/${job.id}/info`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit Job Info</Button></Link>}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Stat tiles aligned with the job — each links into its area */}
        <JobStatsRow stats={stats} jobId={job.id} />

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Summary card — job identity now lives here (moved out of the header) */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold tracking-tight">{job.job_name}</h1>
                <JobStatusBadge status={job.status as JobStatus} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{job.job_number ?? "—"}</span>
                {job.full_address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(job.full_address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {job.full_address}
                  </a>
                )}
              </div>
              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Job</div>
              <KV label="Status"><JobStatusBadge status={job.status as JobStatus} /></KV>
              <KV label="Job #">{job.job_number ?? "—"}</KV>
              {job.lead_number && <KV label="Pre-Con #"><span className="font-mono text-xs text-accent">{job.lead_number}</span></KV>}
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
            </div>

            <Card title="Clients" action={<Link href={`/dashboard/jobs/${job.id}/info`} className="text-xs text-accent hover:underline">Add</Link>}>
              {clients.length === 0 ? <Empty>No clients yet.</Empty> : clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 py-1 text-sm">
                  <Avatar name={`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`} />
                  <span>{`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim()}</span>
                  {c.is_primary && <Badge tone="accent">Primary</Badge>}
                </div>
              ))}
            </Card>

            <Card title="Project Managers" action={<button type="button" onClick={() => setPmModal(true)} className="text-xs text-accent hover:underline">Add</button>}>
              {pms.length === 0 && !manualPm ? <Empty>No project managers yet.</Empty> : (
                <>
                  {pms.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 py-1 text-sm">
                      <Avatar name={u.user?.display_name ?? u.user?.email ?? "?"} />
                      <span>{u.user?.display_name ?? u.user?.email}</span>
                      <span className="text-xs text-muted-foreground">{u.role ?? u.user?.role_slug}</span>
                    </div>
                  ))}
                  {manualPm && (
                    <div className="flex items-center gap-2 py-1 text-sm">
                      <Avatar name={manualPm} />
                      <span>{manualPm}</span>
                      <span className="text-xs text-muted-foreground">Manual</span>
                      <button type="button" onClick={() => void clearManualPm()} className="ml-auto text-muted-foreground hover:text-destructive" title="Remove"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card title="Subs / Vendors" action={<Link href={`/dashboard/jobs/${job.id}/info`} className="text-xs text-accent hover:underline">Manage</Link>}>
              {job.vendors.length === 0 ? <Empty>No subs or vendors yet.</Empty> : job.vendors.map((v) => {
                const label = v.vendor?.company || `${v.vendor?.first_name ?? ""} ${v.vendor?.last_name ?? ""}`.trim() || "Vendor";
                return (
                  <div key={v.id} className="flex items-center gap-2 py-1 text-sm">
                    <Avatar name={label} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {v.role && <span className="shrink-0 text-xs text-muted-foreground">{v.role}</span>}
                  </div>
                );
              })}
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

      {pmModal && (
        <AddPmModal
          existingIds={new Set(pms.map((p) => p.staff_user_id).filter(Boolean) as string[])}
          onTeam={addTeamPm}
          onManual={addManualPm}
          onClose={() => setPmModal(false)}
        />
      )}
    </div>
  );
}

// Add a project manager: pick from the team (filtered to PMs by role/job title)
// or add one manually via "Other".
function AddPmModal({ existingIds, onTeam, onManual, onClose }: { existingIds: Set<string>; onTeam: (s: StaffOption) => void; onManual: (text: string) => void; onClose: () => void }) {
  const [staff, setStaff] = React.useState<StaffOption[] | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [other, setOther] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/staff-options").then((r) => r.json()).then((d) => setStaff(d?.staff ?? [])).catch(() => setStaff([]));
  }, []);
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isPm = (s: StaffOption) => s.role === "project_manager" || /project\s*manager|proj\s*mgr|\bpm\b/i.test(s.job_title);
  const available = (staff ?? []).filter((s) => !existingIds.has(s.id));
  const pmList = available.filter(isPm);
  const list = showAll ? available : pmList;

  function submitManual() {
    if (!form.name.trim()) return;
    setBusy(true);
    const text = [form.name.trim(), [form.email, form.phone].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
    onManual(text);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Add Project Manager</h2>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          {!other ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">From your team</div>
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-accent hover:underline">{showAll ? "Show project managers only" : "Show all team members"}</button>
              </div>
              {staff === null ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : list.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                  {showAll ? "No team members available." : <>No project managers found. <button type="button" onClick={() => setShowAll(true)} className="text-accent hover:underline">Show all team members</button></>}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {list.map((s) => (
                    <button key={s.id} type="button" onClick={() => onTeam(s)} className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-accent/50 hover:bg-muted/40">
                      <Avatar name={s.label} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.job_title || s.role} {s.email && `· ${s.email}`}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setOther(true)} className={cn("mt-3 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-accent/50 hover:text-foreground")}>
                Other — add manually
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Add manually</div>
              <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setOther(false)}>← Team</Button>
                <Button size="sm" variant="accent" onClick={submitManual} disabled={busy || !form.name.trim()}>Add Project Manager</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}

function JobStatsRow({ stats, jobId }: { stats: JobStats; jobId: string }) {
  const tiles: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; href: string }[] = [
    { label: "Documents", value: stats.documents, icon: FileText, href: `/dashboard/jobs/${jobId}/documents` },
    { label: "Contracts", value: stats.contracts, icon: FileSignature, href: `/dashboard/jobs/${jobId}/documents` },
    { label: "SOWs", value: stats.sows, icon: ScrollText, href: `/dashboard/jobs/${jobId}/documents` },
    { label: "Selections", value: stats.selections, icon: SlidersHorizontal, href: `/dashboard/jobs/${jobId}/selections` },
    { label: "Change Orders", value: stats.changeOrders, icon: LayoutGrid, href: `/dashboard/jobs/${jobId}/change-orders` },
    { label: "Invoices", value: stats.invoices, icon: ReceiptText, href: `/dashboard/jobs/${jobId}/invoices` },
    { label: "Active Staff", value: stats.staff, icon: Users, href: `/dashboard/jobs/${jobId}/info` },
    { label: "Subs / Vendors", value: stats.vendors, icon: HardHat, href: `/dashboard/jobs/${jobId}/info` },
    { label: "Quotes", value: stats.quotes, icon: BadgeDollarSign, href: "/dashboard/sales" },
    { label: "Contacts", value: stats.contacts, icon: Contact, href: `/dashboard/jobs/${jobId}/info` },
    { label: "Client Updates", value: stats.updates, icon: MessagesSquare, href: `/dashboard/jobs/${jobId}/client-portal` },
    { label: "Bookings", value: stats.bookings, icon: CalendarClock, href: "/dashboard/bookings" },
  ];
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&>*]:min-w-[42%] [&>*]:shrink-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="group rounded-lg border border-border bg-card p-4 transition hover:border-accent/50 hover:bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t.label}</div>
            <t.icon className="h-4 w-4 shrink-0 text-accent/70 transition group-hover:text-accent" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{t.value}</div>
        </Link>
      ))}
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
