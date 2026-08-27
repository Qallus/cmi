"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { SearchableSelect, SearchableMultiSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";

// Job Type is limited to these two; the finer scope lives in Job Group.
const JOB_TYPE_NAMES = ["Residential", "Commercial"];
import { CONTRACT_TYPES, INSURANCE_STATUSES } from "@/lib/jobs/types";
import type { Job, JobWithRelations, JobType, JobGroup, JobStatus, JobContact, JobInternalUser, JobVendor, JobSettings, JobInsurance, ClientPermissions } from "@/lib/jobs/types";
import { JobDetailNav } from "../job-detail-nav";

type TabKey = "details" | "clients" | "internal" | "vendors" | "advanced" | "insurance";
const TABS: { key: TabKey; label: string }[] = [
  { key: "details", label: "Job Details" }, { key: "clients", label: "Clients" },
  { key: "internal", label: "Internal Users" }, { key: "vendors", label: "Subs / Vendors" },
  { key: "advanced", label: "Advanced Settings" }, { key: "insurance", label: "Insurance / Risk" },
];
type Contact = { id: string; first_name: string; last_name: string; company: string | null; type: string | null };
type StaffOpt = { id: string; label: string; role: string };
const input = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

const CLIENT_PERMS: { key: keyof ClientPermissions; label: string }[] = [
  { key: "schedule_items", label: "Schedule items" }, { key: "locked_selections", label: "Selections" },
  { key: "price_summary", label: "Price summary" }, { key: "invoices", label: "Invoices" },
  { key: "change_order_requests", label: "Submit change orders" }, { key: "warranty_claims", label: "Submit warranty claims" },
  { key: "messages", label: "Messages" }, { key: "files", label: "Files & photos" },
];

export function JobInfoClient({ job, types, groups }: { job: JobWithRelations; types: JobType[]; groups: JobGroup[] }) {
  const [tab, setTab] = React.useState<TabKey>("details");
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [staff, setStaff] = React.useState<StaffOpt[]>([]);
  React.useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/staff-options").then((r) => r.json()).then((d) => setStaff(d?.staff ?? [])).catch(() => {});
  }, []);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="info" />
      <div className="border-b border-border bg-card px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2 py-2">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="mr-1 text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition", tab === t.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl">
          {tab === "details" && <DetailsTab job={job} types={types} groups={groups} />}
          {tab === "clients" && <ClientsTab job={job} contacts={contacts} />}
          {tab === "internal" && <InternalTab job={job} staff={staff} />}
          {tab === "vendors" && <VendorsTab job={job} contacts={contacts} />}
          {tab === "advanced" && <AdvancedTab job={job} />}
          {tab === "insurance" && <InsuranceTab job={job} />}
        </div>
      </div>
    </div>
  );
}

// ─── Details ───────────────────────────────────────────────────
function toDetails(job: Job) {
  return {
    job_name: job.job_name, prefix: job.prefix ?? "", job_type_id: job.job_type_id ?? "", job_group_id: job.job_group_id ?? "",
    status: job.status, job_color: job.job_color ?? "#c2410c", contract_type: job.contract_type ?? "", contract_price: job.contract_price?.toString() ?? "",
    street_address: job.street_address ?? "", city: job.city ?? "", state: job.state ?? "", zip_code: job.zip_code ?? "",
    projected_start_date: job.projected_start_date ?? "", actual_start_date: job.actual_start_date ?? "",
    projected_completion_date: job.projected_completion_date ?? "", actual_completion_date: job.actual_completion_date ?? "",
    square_feet: job.square_feet?.toString() ?? "", permit_number: job.permit_number ?? "", lot_info: job.lot_info ?? "",
    funded_by_construction_loan: !!job.funded_by_construction_loan, internal_notes: job.internal_notes ?? "", vendor_notes: job.vendor_notes ?? "",
  };
}

function DetailsTab({ job, types, groups }: { job: JobWithRelations; types: JobType[]; groups: JobGroup[] }) {
  const [d, setD] = React.useState(() => toDetails(job));
  const saver = useJobAutoSaver(job.id, job.updated_at ?? null, () => ({
    ...d, contract_price: d.contract_price ? Number(d.contract_price) : null, square_feet: d.square_feet ? Number(d.square_feet) : null,
    contract_type: d.contract_type || null, job_type_id: d.job_type_id || null, job_group_id: d.job_group_id || null,
    projected_start_date: d.projected_start_date || null, actual_start_date: d.actual_start_date || null,
    projected_completion_date: d.projected_completion_date || null, actual_completion_date: d.actual_completion_date || null,
  }));

  return (
    <div className="space-y-5">
      {(job.related_opportunity_id || job.related_lead_id) && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Linked from sales: </span>
          {job.related_opportunity_id && <Link href="/dashboard/sales?tab=opportunities" className="font-medium text-accent hover:underline">View Opportunity</Link>}
          {job.related_opportunity_id && job.related_lead_id && " · "}
          {job.related_lead_id && <Link href="/dashboard/contacts" className="font-medium text-accent hover:underline">View Lead</Link>}
        </div>
      )}
      <Section title="Job">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job Name" className="sm:col-span-2"><input className={input} value={d.job_name} onChange={(e) => setD({ ...d, job_name: e.target.value })} /></Field>
          <Field label="Prefix"><input className={input} value={d.prefix} onChange={(e) => setD({ ...d, prefix: e.target.value })} /></Field>
          <Field label="Job Color"><input type="color" className="h-9 w-16 rounded-md border border-border bg-background" value={d.job_color} onChange={(e) => setD({ ...d, job_color: e.target.value })} /></Field>
          <Field label="Status"><Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as JobStatus })}>{ALL_JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_META[s].label}</option>)}</Select></Field>
          <Field label="Job Type"><Select value={d.job_type_id} onChange={(e) => setD({ ...d, job_type_id: e.target.value })}><option value="">— Select —</option>{types.filter((t) => JOB_TYPE_NAMES.includes(t.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Job Group"><Select value={d.job_group_id} onChange={(e) => setD({ ...d, job_group_id: e.target.value })}><option value="">— None —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
          <Field label="Contract Type"><Select value={d.contract_type} onChange={(e) => setD({ ...d, contract_type: e.target.value })}><option value="">— Select —</option>{CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <Field label="Contract Price"><MoneyInput className={input} value={d.contract_price} onChange={(v) => setD({ ...d, contract_price: v })} placeholder="$0.00" /></Field>
        </div>
      </Section>
      <Section title="Address">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Street" className="sm:col-span-2"><AddressAutocomplete className={input} value={d.street_address} onChange={(v) => setD({ ...d, street_address: v })} onPick={(a) => setD({ ...d, street_address: a.street, city: a.city || d.city, state: a.state || d.state, zip_code: a.zip || d.zip_code })} /></Field>
          <Field label="City"><input className={input} value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State"><input className={input} value={d.state} onChange={(e) => setD({ ...d, state: e.target.value })} /></Field>
            <Field label="Zip"><input className={input} value={d.zip_code} onChange={(e) => setD({ ...d, zip_code: e.target.value })} /></Field>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Changing the address re-geocodes the job for the map on save.</p>
      </Section>
      <Section title="Schedule">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Projected Start"><Input type="date" value={d.projected_start_date} onChange={(e) => setD({ ...d, projected_start_date: e.target.value })} /></Field>
          <Field label="Actual Start"><Input type="date" value={d.actual_start_date} onChange={(e) => setD({ ...d, actual_start_date: e.target.value })} /></Field>
          <Field label="Projected Completion"><Input type="date" value={d.projected_completion_date} onChange={(e) => setD({ ...d, projected_completion_date: e.target.value })} /></Field>
          <Field label="Actual Completion"><Input type="date" value={d.actual_completion_date} onChange={(e) => setD({ ...d, actual_completion_date: e.target.value })} /></Field>
        </div>
      </Section>
      <Section title="Additional Info">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Square Feet"><input type="number" className={input} value={d.square_feet} onChange={(e) => setD({ ...d, square_feet: e.target.value })} /></Field>
          <Field label="Permit Number"><input className={input} value={d.permit_number} onChange={(e) => setD({ ...d, permit_number: e.target.value })} /></Field>
          <Field label="Lot Info" className="sm:col-span-2"><input className={input} value={d.lot_info} onChange={(e) => setD({ ...d, lot_info: e.target.value })} /></Field>
          <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" checked={d.funded_by_construction_loan} onChange={(e) => setD({ ...d, funded_by_construction_loan: e.target.checked })} /> Funded by construction loan</label>
        </div>
        <Field label="Notes for internal users" className="mt-3"><Textarea value={d.internal_notes} onChange={(e) => setD({ ...d, internal_notes: e.target.value })} /></Field>
        <Field label="Notes for subs / vendors" className="mt-3"><Textarea value={d.vendor_notes} onChange={(e) => setD({ ...d, vendor_notes: e.target.value })} /></Field>
      </Section>
      <AutoSaveBar saver={saver} onLoadTheirs={(row) => setD(toDetails(row as unknown as Job))} />
    </div>
  );
}

// ─── Clients ───────────────────────────────────────────────────
function ClientsTab({ job, contacts }: { job: JobWithRelations; contacts: Contact[] }) {
  const [list, setList] = React.useState<JobContact[]>(job.contacts);
  const [addId, setAddId] = React.useState("");
  const avail = contacts.filter((c) => c.type !== "Vendor" && c.type !== "Sub Contractor" && !list.some((l) => l.contact_id === c.id));

  async function add() {
    if (!addId) return;
    const res = await fetch(`/api/jobs/${job.id}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_id: addId, role: "client", is_primary: list.length === 0 }) });
    if (res.ok) { const created = await res.json(); setList((l) => [...l, created]); setAddId(""); }
  }
  async function remove(id: string) {
    if (await del(`/api/jobs/${job.id}/contacts/${id}`)) setList((l) => l.filter((x) => x.id !== id));
  }
  async function patch(id: string, body: Partial<JobContact>) {
    const res = await fetch(`/api/jobs/${job.id}/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const upd = await res.json(); setList((l) => l.map((x) => (x.id === id ? upd : x))); }
  }
  function togglePerm(c: JobContact, key: keyof ClientPermissions) {
    const perms = { ...(c.permissions ?? {}), [key]: !c.permissions?.[key] };
    void patch(c.id, { permissions: perms });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Add existing contact"><SearchableSelect placeholder="— Choose contact —" value={addId} onChange={setAddId} options={avail.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`.trim() || c.company || c.id, sublabel: c.company ?? undefined }))} /></Field></div>
        <Button size="sm" variant="accent" onClick={() => void add()} disabled={!addId}>Add</Button>
        <Link href="/dashboard/contacts" className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">New contact</Link>
      </div>
      {list.length === 0 ? <Empty>No client contacts yet.</Empty> : list.map((c) => (
        <div key={c.id} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">{`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim() || "Contact"}</div>
            <button type="button" onClick={() => void remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={c.is_primary} onChange={() => void patch(c.id, { is_primary: !c.is_primary })} /> Primary</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={c.portal_access_enabled} onChange={() => void patch(c.id, { portal_access_enabled: !c.portal_access_enabled })} /> Client portal access</label>
          </div>
          {c.portal_access_enabled && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Portal permissions</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {CLIENT_PERMS.map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!c.permissions?.[p.key]} onChange={() => togglePerm(c, p.key)} /> {p.label}</label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Client payment settings (cards/ACH/fees) are planned once payment processing is connected.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Internal users ────────────────────────────────────────────
function InternalTab({ job, staff }: { job: JobWithRelations; staff: StaffOpt[] }) {
  const [list, setList] = React.useState<JobInternalUser[]>(job.internal_users);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState(false);
  const avail = staff.filter((s) => !list.some((l) => l.staff_user_id === s.id));
  async function add() {
    if (!picked.length) return;
    setAdding(true);
    const added: JobInternalUser[] = [];
    for (const id of picked) {
      const res = await fetch(`/api/jobs/${job.id}/internal-users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_user_id: id }) });
      if (res.ok) added.push(await res.json());
    }
    setList((l) => [...l, ...added]);
    setPicked([]);
    setAdding(false);
  }
  async function remove(id: string) { if (await del(`/api/jobs/${job.id}/internal-users/${id}`)) setList((l) => l.filter((x) => x.id !== id)); }
  async function patch(id: string, body: Partial<JobInternalUser>) {
    const res = await fetch(`/api/jobs/${job.id}/internal-users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const upd = await res.json(); setList((l) => l.map((x) => (x.id === id ? upd : x))); }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Add internal users"><SearchableMultiSelect placeholder="Search staff to add…" values={picked} onChange={setPicked} options={avail.map((s) => ({ value: s.id, label: s.label, sublabel: s.role }))} /></Field></div>
        <Button size="sm" variant="accent" onClick={() => void add()} disabled={!picked.length || adding}>{adding ? "Adding…" : picked.length ? `Add ${picked.length}` : "Add"}</Button>
      </div>
      {list.length === 0 ? <Empty>No internal users assigned.</Empty> : list.map((u) => (
        <div key={u.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <div className="text-sm font-medium">{u.user?.display_name ?? u.user?.email}</div>
            <div className="text-xs text-muted-foreground">{u.user?.role_slug}</div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={u.notifications_enabled} onChange={() => void patch(u.id, { notifications_enabled: !u.notifications_enabled })} /> Notifications</label>
            <button type="button" onClick={() => void remove(u.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Vendors ───────────────────────────────────────────────────
function VendorsTab({ job, contacts }: { job: JobWithRelations; contacts: Contact[] }) {
  const [list, setList] = React.useState<JobVendor[]>(job.vendors);
  const [addId, setAddId] = React.useState("");
  const avail = contacts.filter((c) => (c.type === "Vendor" || c.type === "Sub Contractor") && !list.some((l) => l.vendor_contact_id === c.id));
  async function add() {
    if (!addId) return;
    const res = await fetch(`/api/jobs/${job.id}/vendors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_contact_id: addId }) });
    if (res.ok) { const created = await res.json(); setList((l) => [...l, created]); setAddId(""); }
  }
  async function remove(id: string) { if (await del(`/api/jobs/${job.id}/vendors/${id}`)) setList((l) => l.filter((x) => x.id !== id)); }
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Add sub / vendor"><Select value={addId} onChange={(e) => setAddId(e.target.value)}><option value="">— Choose vendor —</option>{avail.map((c) => <option key={c.id} value={c.id}>{`${c.first_name} ${c.last_name}`.trim() || c.company || c.id}</option>)}</Select></Field></div>
        <Button size="sm" variant="accent" onClick={() => void add()} disabled={!addId}>Add</Button>
      </div>
      {list.length === 0 ? <Empty>No subs or vendors have access to this job yet. Access & notification permissions can be tuned once assigned.</Empty> : list.map((v) => (
        <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="text-sm font-medium">{`${v.vendor?.first_name ?? ""} ${v.vendor?.last_name ?? ""}`.trim() || v.vendor?.company || "Vendor"}</div>
          <button type="button" onClick={() => void remove(v.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Vendor access scopes (schedule, tasks, files, POs, selections) will be editable here as those modules come online.</p>
    </div>
  );
}

// ─── Advanced settings ─────────────────────────────────────────
function AdvancedTab({ job }: { job: JobWithRelations }) {
  const s0 = job.settings;
  const [s, setS] = React.useState({
    geofencing_enabled: !!s0?.geofencing_enabled, allow_allowances: s0?.allow_allowances ?? true, schedule_online: !!s0?.schedule_online,
    client_updates_enabled: s0?.client_updates_enabled ?? true, daily_logs_enabled: s0?.daily_logs_enabled ?? true, warranty_claims_enabled: s0?.warranty_claims_enabled ?? true,
    markup_type: s0?.markup_type ?? "markup", markup_percentage: s0?.markup_percentage?.toString() ?? "", default_tax_rate: s0?.default_tax_rate?.toString() ?? "",
    individual_po_limit: s0?.individual_po_limit?.toString() ?? "", total_po_limit: s0?.total_po_limit?.toString() ?? "",
  });
  const [isTemplate, setIsTemplate] = React.useState(job.is_template);
  const settings = useSaver(`/api/jobs/${job.id}/settings`, () => ({ ...s, markup_percentage: s.markup_percentage ? Number(s.markup_percentage) : null, default_tax_rate: s.default_tax_rate ? Number(s.default_tax_rate) : null, individual_po_limit: s.individual_po_limit ? Number(s.individual_po_limit) : null, total_po_limit: s.total_po_limit ? Number(s.total_po_limit) : null }));

  async function saveTemplate() {
    await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_template: isTemplate }) });
  }

  return (
    <div className="space-y-5">
      <Section title="Project Management">
        <div className="space-y-2">
          {([["geofencing_enabled", "Enable geofencing on Time Clock shifts"], ["allow_allowances", "Allow creation of allowances"], ["schedule_online", "Enable schedule publishing (online)"], ["client_updates_enabled", "Enable client updates"], ["daily_logs_enabled", "Enable daily logs"], ["warranty_claims_enabled", "Enable warranty claims"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> {label}</label>
          ))}
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
      <SaveBar saving={settings.saving} msg={settings.msg} onSave={settings.save} />
      <Section title="Template">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} /> Make this job a working template</label>
        <p className="mt-1 text-xs text-muted-foreground">Templates are excluded from the Jobs List and don&apos;t consume a job number. Create new jobs from them via “New Job → From Template.”</p>
        <div className="mt-2"><Button size="sm" variant="outline" onClick={() => void saveTemplate()}>Save template setting</Button></div>
      </Section>
    </div>
  );
}

// ─── Insurance / Risk ──────────────────────────────────────────
function InsuranceTab({ job }: { job: JobWithRelations }) {
  const i0 = job.insurance;
  const [i, setI] = React.useState({
    status: i0?.status ?? "not_started", provider: i0?.provider ?? "", policy_number: i0?.policy_number ?? "",
    policy_start_date: i0?.policy_start_date ?? "", policy_end_date: i0?.policy_end_date ?? "",
    coverage_amount: i0?.coverage_amount?.toString() ?? "", notes: i0?.notes ?? "",
  });
  const { saving, msg, save } = useSaver(`/api/jobs/${job.id}/insurance`, () => ({ ...i, coverage_amount: i.coverage_amount ? Number(i.coverage_amount) : null, policy_start_date: i.policy_start_date || null, policy_end_date: i.policy_end_date || null }));
  return (
    <div className="space-y-4">
      <Section title="Insurance / Risk">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Builder's Risk Status"><Select value={i.status} onChange={(e) => setI({ ...i, status: e.target.value })}>{INSURANCE_STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}</Select></Field>
          <Field label="Provider"><input className={input} value={i.provider} onChange={(e) => setI({ ...i, provider: e.target.value })} /></Field>
          <Field label="Policy Number"><input className={input} value={i.policy_number} onChange={(e) => setI({ ...i, policy_number: e.target.value })} /></Field>
          <Field label="Coverage Amount ($)"><input type="number" className={input} value={i.coverage_amount} onChange={(e) => setI({ ...i, coverage_amount: e.target.value })} /></Field>
          <Field label="Policy Start"><Input type="date" value={i.policy_start_date} onChange={(e) => setI({ ...i, policy_start_date: e.target.value })} /></Field>
          <Field label="Policy End"><Input type="date" value={i.policy_end_date} onChange={(e) => setI({ ...i, policy_end_date: e.target.value })} /></Field>
        </div>
        <Field label="Notes" className="mt-3"><Textarea value={i.notes} onChange={(e) => setI({ ...i, notes: e.target.value })} /></Field>
        <p className="mt-2 text-xs text-muted-foreground">Certificate upload &amp; “request quote” are planned.</p>
      </Section>
      <SaveBar saving={saving} msg={msg} onSave={save} />
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────
function useSaver(url: string, build: () => Record<string, unknown>) {
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(build()) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: "Saved." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed." }); }
    finally { setSaving(false); }
  }
  return { saving, msg, save };
}
async function del(url: string): Promise<boolean> {
  const res = await fetch(url, { method: "DELETE" });
  return res.ok || res.status === 204;
}

type JobRow = { updated_at?: string | null } & Record<string, unknown>;

// Auto-saves the job (debounced) with optimistic-concurrency protection: it
// sends the version it loaded, so a save from another device/tab can't silently
// overwrite. On a conflict the user chooses to load the other changes or keep
// theirs.
function useJobAutoSaver(jobId: string, initialUpdatedAt: string | null, build: () => Record<string, unknown>) {
  const [baseUpdatedAt, setBaseUpdatedAt] = React.useState<string | null>(initialUpdatedAt);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [errorText, setErrorText] = React.useState("");
  const [conflict, setConflict] = React.useState<JobRow | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = React.useRef(true);
  const baseRef = React.useRef(baseUpdatedAt);
  baseRef.current = baseUpdatedAt;
  const buildRef = React.useRef(build);
  buildRef.current = build;

  const payloadKey = JSON.stringify(build());

  async function doSave(expectedOverride?: string | null) {
    setStatus("saving"); setErrorText("");
    try {
      const expected = expectedOverride !== undefined ? expectedOverride : baseRef.current;
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildRef.current(), base_updated_at: expected ?? undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; current?: JobRow; updated_at?: string };
      if (res.status === 409) { setConflict(j.current ?? null); setStatus("conflict"); return; }
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setBaseUpdatedAt(j.updated_at ?? baseRef.current);
      setStatus("saved");
    } catch (e) {
      setStatus("error"); setErrorText(e instanceof Error ? e.message : "Save failed.");
    }
  }

  React.useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (status === "conflict") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  return {
    status, errorText, conflict,
    saveNow: () => void doSave(),
    overwrite: () => { const c = conflict; if (c) { setConflict(null); void doSave(c.updated_at ?? null); } },
    acceptTheirs: (): JobRow | null => { const c = conflict; if (c) { setBaseUpdatedAt(c.updated_at ?? null); setConflict(null); setStatus("idle"); } return c; },
  };
}

function AutoSaveBar({ saver, onLoadTheirs }: { saver: ReturnType<typeof useJobAutoSaver>; onLoadTheirs: (row: JobRow) => void }) {
  if (saver.conflict) {
    return (
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm md:-mx-6 md:px-6">
        <span className="text-amber-700 dark:text-amber-400">This job was changed on another device or tab. Choose which version to keep.</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { const r = saver.acceptTheirs(); if (r) onLoadTheirs(r); }}>Load their changes</Button>
          <Button size="sm" variant="accent" onClick={saver.overwrite}>Keep mine</Button>
        </div>
      </div>
    );
  }
  const text =
    saver.status === "saving" ? "Saving…" :
    saver.status === "saved" ? "All changes saved" :
    saver.status === "error" ? (saver.errorText || "Save failed") :
    "Auto-save on";
  const tone = saver.status === "error" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5 text-xs md:-mx-6 md:px-6">
      <span className={tone}>{text}</span>
      <Button size="sm" variant="outline" onClick={saver.saveNow} disabled={saver.status === "saving"}>Save now</Button>
    </div>
  );
}
function SaveBar({ saving, msg, onSave }: { saving: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-destructive")}>{msg.text}</span>}
      <Button size="sm" variant="accent" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div><div className="rounded-lg border border-border p-4">{children}</div></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}
