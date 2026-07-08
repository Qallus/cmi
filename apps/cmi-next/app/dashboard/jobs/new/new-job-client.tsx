"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";
import { CONTRACT_TYPES, INSURANCE_STATUSES } from "@/lib/jobs/types";
import type { JobType, JobGroup, JobStatus } from "@/lib/jobs/types";

type TabKey = "details" | "clients" | "internal" | "vendors" | "advanced" | "insurance";
const TABS: { key: TabKey; label: string }[] = [
  { key: "details", label: "Job Details" },
  { key: "clients", label: "Clients" },
  { key: "internal", label: "Internal Users" },
  { key: "vendors", label: "Subs / Vendors" },
  { key: "advanced", label: "Advanced Settings" },
  { key: "insurance", label: "Insurance / Risk" },
];

type Contact = { id: string; first_name: string; last_name: string; company: string | null; phone: string | null; type: string | null };
type StaffOpt = { id: string; label: string; role: string };

const input = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function NewJobClient({ types, groups }: { types: JobType[]; groups: JobGroup[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("details");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [staff, setStaff] = React.useState<StaffOpt[]>([]);
  React.useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/staff-options").then((r) => r.json()).then((d) => setStaff(d?.staff ?? [])).catch(() => {});
  }, []);

  // Core job fields
  const [d, setD] = React.useState({
    job_name: "", prefix: "", job_type_id: "", job_group_id: "", status: "draft" as JobStatus,
    job_color: "#c2410c", contract_type: "", contract_price: "" as string,
    street_address: "", city: "", state: "AZ", zip_code: "",
    projected_start_date: "", projected_completion_date: "",
    square_feet: "" as string, permit_number: "", lot_info: "",
    funded_by_construction_loan: false, internal_notes: "", vendor_notes: "",
  });
  // Advanced settings
  const [s, setS] = React.useState({
    geofencing_enabled: false, allow_allowances: true, schedule_online: false,
    client_updates_enabled: true, daily_logs_enabled: true, warranty_claims_enabled: true,
    markup_type: "markup", markup_percentage: "" as string, default_tax_rate: "" as string,
    individual_po_limit: "" as string, total_po_limit: "" as string,
  });
  // Insurance
  const [ins, setIns] = React.useState({
    status: "not_started", provider: "", policy_number: "",
    policy_start_date: "", policy_end_date: "", coverage_amount: "" as string, notes: "",
  });
  // Associations to attach after the job is created
  const [clientIds, setClientIds] = React.useState<Set<string>>(new Set());
  const [userIds, setUserIds] = React.useState<Set<string>>(new Set());
  const [vendorIds, setVendorIds] = React.useState<Set<string>>(new Set());

  const vendorContacts = contacts.filter((c) => c.type === "Vendor" || c.type === "Sub Contractor");
  const clientContacts = contacts.filter((c) => c.type !== "Vendor" && c.type !== "Sub Contractor");

  function num(v: string): number | null { return v.trim() === "" ? null : Number(v); }
  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    set((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save(asDraft: boolean) {
    if (!d.job_name.trim()) { setError("Job name is required."); setTab("details"); return; }
    if (!asDraft && !d.job_type_id) { setError("Job type is required (or Save as Draft)."); setTab("details"); return; }
    setSaving(true); setError(null);
    try {
      // 1) Create the job (mints the job number).
      const jobRes = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_name: d.job_name, prefix: d.prefix || null, job_type_id: d.job_type_id || null,
          job_group_id: d.job_group_id || null, status: asDraft ? "draft" : d.status,
          job_color: d.job_color || null, contract_type: d.contract_type || null, contract_price: num(d.contract_price),
          street_address: d.street_address || null, city: d.city || null, state: d.state || null, zip_code: d.zip_code || null,
          projected_start_date: d.projected_start_date || null, projected_completion_date: d.projected_completion_date || null,
          square_feet: num(d.square_feet), permit_number: d.permit_number || null, lot_info: d.lot_info || null,
          funded_by_construction_loan: d.funded_by_construction_loan, internal_notes: d.internal_notes || null, vendor_notes: d.vendor_notes || null,
        }),
      });
      const job = await jobRes.json();
      if (!jobRes.ok) throw new Error(job.error ?? `HTTP ${jobRes.status}`);
      const jobId = job.id as string;

      // 2) Attach associations + settings + insurance (best-effort, in parallel).
      await Promise.all([
        ...[...clientIds].map((cid) => fetch(`/api/jobs/${jobId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_id: cid, role: "client" }) })),
        ...[...userIds].map((uid) => fetch(`/api/jobs/${jobId}/internal-users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_user_id: uid }) })),
        ...[...vendorIds].map((vid) => fetch(`/api/jobs/${jobId}/vendors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_contact_id: vid }) })),
        fetch(`/api/jobs/${jobId}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, markup_percentage: num(s.markup_percentage), default_tax_rate: num(s.default_tax_rate), individual_po_limit: num(s.individual_po_limit), total_po_limit: num(s.total_po_limit) }) }),
        fetch(`/api/jobs/${jobId}/insurance`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ins, coverage_amount: num(ins.coverage_amount), policy_start_date: ins.policy_start_date || null, policy_end_date: ins.policy_end_date || null }) }),
      ]);

      router.push(`/dashboard/jobs/${jobId}/summary`);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); setSaving(false); }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Management</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">New Job</h1>
            <p className="mt-1 text-sm text-muted-foreground">A job number is generated automatically when you save.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void save(true)} disabled={saving}>Save as Draft</Button>
            <Button size="sm" variant="accent" onClick={() => void save(false)} disabled={saving}>{saving ? "Saving…" : "Create Job"}</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition", tab === t.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
        {error && <div className="mt-3 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {tab === "details" && (
            <>
              <Section title="Job">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Job Name" required className="sm:col-span-2"><input className={input} value={d.job_name} onChange={(e) => setD({ ...d, job_name: e.target.value })} /></Field>
                  <Field label="Prefix"><input className={input} value={d.prefix} onChange={(e) => setD({ ...d, prefix: e.target.value })} placeholder="e.g. 26" /></Field>
                  <Field label="Job Color"><input type="color" className="h-9 w-16 rounded-md border border-border bg-background" value={d.job_color} onChange={(e) => setD({ ...d, job_color: e.target.value })} /></Field>
                  <Field label="Job Type"><Select value={d.job_type_id} onChange={(e) => setD({ ...d, job_type_id: e.target.value })}><option value="">— Select —</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
                  <Field label="Job Group"><Select value={d.job_group_id} onChange={(e) => setD({ ...d, job_group_id: e.target.value })}><option value="">— None —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
                  <Field label="Status"><Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as JobStatus })}>{ALL_JOB_STATUSES.map((st) => <option key={st} value={st}>{JOB_STATUS_META[st].label}</option>)}</Select></Field>
                </div>
              </Section>
              <Section title="Contract">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Contract Type"><Select value={d.contract_type} onChange={(e) => setD({ ...d, contract_type: e.target.value })}><option value="">— Select —</option>{CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
                  <Field label="Contract Price ($)"><input type="number" className={input} value={d.contract_price} onChange={(e) => setD({ ...d, contract_price: e.target.value })} /></Field>
                </div>
              </Section>
              <Section title="Address">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Street Address" className="sm:col-span-2"><input className={input} value={d.street_address} onChange={(e) => setD({ ...d, street_address: e.target.value })} /></Field>
                  <Field label="City"><input className={input} value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="State"><input className={input} value={d.state} onChange={(e) => setD({ ...d, state: e.target.value })} /></Field>
                    <Field label="Zip"><input className={input} value={d.zip_code} onChange={(e) => setD({ ...d, zip_code: e.target.value })} /></Field>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">We&apos;ll geocode this address for the Jobs Map when you save.</p>
              </Section>
              <Section title="Schedule & Detail">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Projected Start"><Input type="date" value={d.projected_start_date} onChange={(e) => setD({ ...d, projected_start_date: e.target.value })} /></Field>
                  <Field label="Projected Completion"><Input type="date" value={d.projected_completion_date} onChange={(e) => setD({ ...d, projected_completion_date: e.target.value })} /></Field>
                  <Field label="Square Feet"><input type="number" className={input} value={d.square_feet} onChange={(e) => setD({ ...d, square_feet: e.target.value })} /></Field>
                  <Field label="Permit Number"><input className={input} value={d.permit_number} onChange={(e) => setD({ ...d, permit_number: e.target.value })} /></Field>
                  <Field label="Lot Info" className="sm:col-span-2"><input className={input} value={d.lot_info} onChange={(e) => setD({ ...d, lot_info: e.target.value })} /></Field>
                  <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" checked={d.funded_by_construction_loan} onChange={(e) => setD({ ...d, funded_by_construction_loan: e.target.checked })} /> Funded by construction loan</label>
                </div>
                <Field label="Notes for internal users" className="mt-3"><Textarea value={d.internal_notes} onChange={(e) => setD({ ...d, internal_notes: e.target.value })} /></Field>
                <Field label="Notes for subs / vendors" className="mt-3"><Textarea value={d.vendor_notes} onChange={(e) => setD({ ...d, vendor_notes: e.target.value })} /></Field>
              </Section>
            </>
          )}

          {tab === "clients" && (
            <Section title="Client Contacts">
              <p className="mb-2 text-xs text-muted-foreground">Select client contacts to associate. Portal permissions can be tuned per client after the job is created.</p>
              <PickList items={clientContacts.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`.trim() || c.company || c.id, meta: c.company ?? c.phone ?? "" }))} selected={clientIds} onToggle={(id) => toggle(setClientIds, id)} empty="No contacts found." />
            </Section>
          )}
          {tab === "internal" && (
            <Section title="Internal Users">
              <PickList items={staff.map((u) => ({ id: u.id, label: u.label, meta: u.role }))} selected={userIds} onToggle={(id) => toggle(setUserIds, id)} empty="No staff found." />
            </Section>
          )}
          {tab === "vendors" && (
            <Section title="Subs / Vendors">
              <PickList items={vendorContacts.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`.trim() || c.company || c.id, meta: c.company ?? "" }))} selected={vendorIds} onToggle={(id) => toggle(setVendorIds, id)} empty="No vendor/sub contacts yet. Add them in Contacts (type Vendor / Sub Contractor)." />
            </Section>
          )}

          {tab === "advanced" && (
            <>
              <Section title="Project Management">
                <div className="space-y-2">
                  <Check label="Enable geofencing on Time Clock shifts" v={s.geofencing_enabled} on={(v) => setS({ ...s, geofencing_enabled: v })} />
                  <Check label="Allow creation of allowances" v={s.allow_allowances} on={(v) => setS({ ...s, allow_allowances: v })} />
                  <Check label="Enable schedule publishing (online)" v={s.schedule_online} on={(v) => setS({ ...s, schedule_online: v })} />
                  <Check label="Enable client updates" v={s.client_updates_enabled} on={(v) => setS({ ...s, client_updates_enabled: v })} />
                  <Check label="Enable daily logs" v={s.daily_logs_enabled} on={(v) => setS({ ...s, daily_logs_enabled: v })} />
                  <Check label="Enable warranty claims" v={s.warranty_claims_enabled} on={(v) => setS({ ...s, warranty_claims_enabled: v })} />
                </div>
              </Section>
              <Section title="Margin / Markup & Tax">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Type"><Select value={s.markup_type} onChange={(e) => setS({ ...s, markup_type: e.target.value })}><option value="markup">Markup</option><option value="margin">Margin</option></Select></Field>
                  <Field label="Percentage (%)"><input type="number" className={input} value={s.markup_percentage} onChange={(e) => setS({ ...s, markup_percentage: e.target.value })} /></Field>
                  <Field label="Default Tax Rate (%)"><input type="number" className={input} value={s.default_tax_rate} onChange={(e) => setS({ ...s, default_tax_rate: e.target.value })} /></Field>
                </div>
              </Section>
              <Section title="Purchase Order Limits">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Individual PO limit ($)"><input type="number" className={input} value={s.individual_po_limit} onChange={(e) => setS({ ...s, individual_po_limit: e.target.value })} /></Field>
                  <Field label="Total Job PO limit ($)"><input type="number" className={input} value={s.total_po_limit} onChange={(e) => setS({ ...s, total_po_limit: e.target.value })} /></Field>
                </div>
              </Section>
            </>
          )}

          {tab === "insurance" && (
            <Section title="Insurance / Risk">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Builder's Risk Status"><Select value={ins.status} onChange={(e) => setIns({ ...ins, status: e.target.value })}>{INSURANCE_STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}</Select></Field>
                <Field label="Provider"><input className={input} value={ins.provider} onChange={(e) => setIns({ ...ins, provider: e.target.value })} /></Field>
                <Field label="Policy Number"><input className={input} value={ins.policy_number} onChange={(e) => setIns({ ...ins, policy_number: e.target.value })} /></Field>
                <Field label="Coverage Amount ($)"><input type="number" className={input} value={ins.coverage_amount} onChange={(e) => setIns({ ...ins, coverage_amount: e.target.value })} /></Field>
                <Field label="Policy Start"><Input type="date" value={ins.policy_start_date} onChange={(e) => setIns({ ...ins, policy_start_date: e.target.value })} /></Field>
                <Field label="Policy End"><Input type="date" value={ins.policy_end_date} onChange={(e) => setIns({ ...ins, policy_end_date: e.target.value })} /></Field>
              </div>
              <Field label="Notes" className="mt-3"><Textarea value={ins.notes} onChange={(e) => setIns({ ...ins, notes: e.target.value })} /></Field>
              <p className="mt-2 text-xs text-muted-foreground">Certificate upload &amp; “request quote” are planned. Enter policy details here for now.</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div><div className="rounded-lg border border-border p-4">{children}</div></div>;
}
function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} /> {label}</label>;
}
function PickList({ items, selected, onToggle, empty }: { items: { id: string; label: string; meta?: string }[]; selected: Set<string>; onToggle: (id: string) => void; empty: string }) {
  if (items.length === 0) return <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{empty}</div>;
  return (
    <div className="max-h-80 space-y-1 overflow-y-auto">
      {items.map((it) => (
        <label key={it.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <input type="checkbox" checked={selected.has(it.id)} onChange={() => onToggle(it.id)} />
          <span className="font-medium">{it.label}</span>
          {it.meta && <span className="text-xs text-muted-foreground">· {it.meta}</span>}
        </label>
      ))}
    </div>
  );
}
