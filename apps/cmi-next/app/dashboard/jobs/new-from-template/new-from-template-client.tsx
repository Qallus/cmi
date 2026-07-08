"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPES } from "@/lib/jobs/types";
import type { Job, JobType, JobGroup } from "@/lib/jobs/types";

type Contact = { id: string; first_name: string; last_name: string; company: string | null; type: string | null };
const input = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function NewFromTemplateClient({ templates, types, groups }: { templates: Job[]; types: JobType[]; groups: JobGroup[] }) {
  const router = useRouter();
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [f, setF] = React.useState({
    template_id: templates[0]?.id ?? "", job_name: "", job_group_id: "", job_type_id: "",
    projected_start_date: "", turn_schedule_online: false, contract_type: "", contact_id: "", accounting_customer_id: "",
  });

  React.useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function save() {
    if (!f.template_id) { setError("Choose a source template."); return; }
    if (!f.job_name.trim()) { setError("New job name is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/jobs/from-template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: f.template_id, job_name: f.job_name, job_group_id: f.job_group_id || null,
          job_type_id: f.job_type_id || null, projected_start_date: f.projected_start_date || null,
          turn_schedule_online: f.turn_schedule_online, contract_type: f.contract_type || null,
          contact_id: f.contact_id || null, accounting_customer_id: f.accounting_customer_id || null,
        }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error ?? `HTTP ${res.status}`);
      router.push(`/dashboard/jobs/${job.id}/summary`);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); setSaving(false); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Management</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">New Job From Template</h1>
          <p className="mt-1 text-sm text-muted-foreground">Copies safe template data (details, settings, group/type). Invoices, payments, logs, and messages are never copied.</p>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No templates yet. Mark a job as a template in its Advanced Settings, then create from it here.
            <div className="mt-3"><Link href="/dashboard/jobs/new" className="font-medium text-accent hover:underline">Create a job from scratch →</Link></div>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border p-5">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source Template" required className="sm:col-span-2"><Select value={f.template_id} onChange={(e) => setF({ ...f, template_id: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.job_name}</option>)}</Select></Field>
              <Field label="New Job Name" required className="sm:col-span-2"><input className={input} value={f.job_name} onChange={(e) => setF({ ...f, job_name: e.target.value })} /></Field>
              <Field label="Job Type"><Select value={f.job_type_id} onChange={(e) => setF({ ...f, job_type_id: e.target.value })}><option value="">— From template —</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
              <Field label="Job Group"><Select value={f.job_group_id} onChange={(e) => setF({ ...f, job_group_id: e.target.value })}><option value="">— From template —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
              <Field label="Contract Type"><Select value={f.contract_type} onChange={(e) => setF({ ...f, contract_type: e.target.value })}><option value="">— Select —</option>{CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
              <Field label="Projected Start"><Input type="date" value={f.projected_start_date} onChange={(e) => setF({ ...f, projected_start_date: e.target.value })} /></Field>
              <Field label="Client Contact"><Select value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}><option value="">— None —</option>{contacts.map((c) => <option key={c.id} value={c.id}>{`${c.first_name} ${c.last_name}`.trim() || c.company || c.id}</option>)}</Select></Field>
              <Field label="Accounting Customer"><input className={input} value={f.accounting_customer_id} onChange={(e) => setF({ ...f, accounting_customer_id: e.target.value })} placeholder="(future integration)" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.turn_schedule_online} onChange={(e) => setF({ ...f, turn_schedule_online: e.target.checked })} /> Turn schedule online</label>
            <div className="flex justify-end gap-2 pt-1">
              <Link href="/dashboard/jobs" className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</Link>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Creating…" : "Create Job"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>{children}</div>;
}
