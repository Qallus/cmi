"use client";

import * as React from "react";
import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  CheckCircle2,
  Eye,
  FileUp,
  LayoutTemplate,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Contact, ContactDraft, ContactStatus, ContactType } from "@/lib/contacts/types";

const CONTACT_TYPES: ContactType[] = ["Lead", "Client", "Vendor", "Sub Contractor"];
const CONTACT_ONLY_TYPES: ContactType[] = ["Client", "Vendor", "Sub Contractor"];
const STAFF_ROLES = ["admin", "project_manager", "designer", "estimator", "superintendent", "viewer"] as const;
type StaffRole = typeof STAFF_ROLES[number];
const STATUSES: ContactStatus[] = ["active", "inactive", "archived"];
const STATES = ["AZ", "CA", "NV", "CO", "UT", "NM", "TX", "FL", "NY", "WA", "OR", "ID", "MT"];

const TYPE_TONES: Record<string, "accent" | "success" | "warning" | "default"> = {
  Client: "success",
  Lead: "warning",
  Vendor: "info" as "default",
  "Sub Contractor": "default",
};

function statusTone(s: string): "success" | "warning" | "danger" | "default" {
  if (s === "active") return "success";
  if (s === "inactive") return "warning";
  if (s === "archived") return "danger";
  return "default";
}

function initials(c: Contact) {
  return [(c.first_name[0] ?? ""), (c.last_name[0] ?? "")].join("").toUpperCase() || "?";
}

function fullName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
}

const EMPTY_DRAFT: ContactDraft = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
  type: "Lead",
  status: "active",
  address: "",
  city: "",
  state: "AZ",
  zip: "",
  notes: "",
  tags: [],
  source: "",
};

type ModalMode = "add" | "edit" | "view";

export function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = React.useState<Contact[]>(initialContacts);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [perPage, setPerPage] = React.useState(25);
  const [page, setPage] = React.useState(1);
  const [modal, setModal] = React.useState<{ mode: ModalMode; contact?: Contact } | null>(null);
  const [draft, setDraft] = React.useState<ContactDraft>(EMPTY_DRAFT);
  const [tagInput, setTagInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [contactAction, setContactAction] = React.useState<{ type: "call" | "sms" | "email"; contact: Contact } | null>(null);
  const [viewMode, setViewMode] = React.useState<"contacts" | "leads">("contacts");
  const [convertLead, setConvertLead] = React.useState<Contact | null>(null);

  React.useEffect(() => {
    function handleDashboardSearch(event: Event) {
      const detail = (event as CustomEvent<{ value?: string }>).detail;
      setSearch(detail?.value || "");
      setPage(1);
    }

    window.addEventListener("cmi-dashboard-search", handleDashboardSearch);
    return () => window.removeEventListener("cmi-dashboard-search", handleDashboardSearch);
  }, []);

  const leadsCount = React.useMemo(() => contacts.filter((c) => c.type === "Lead").length, [contacts]);
  const contactsCount = contacts.length - leadsCount;

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      if (viewMode === "leads" && c.type !== "Lead") return false;
      if (viewMode === "contacts" && c.type === "Lead") return false;
      if (q && !fullName(c).toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !(c.phone ?? "").includes(q) && !(c.company ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [contacts, search, typeFilter, statusFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageContacts = filtered.slice((page - 1) * perPage, page * perPage);

  function openAdd() {
    setDraft({ ...EMPTY_DRAFT, type: viewMode === "leads" ? "Lead" : "Client" });
    setTagInput("");
    setError(null);
    setModal({ mode: "add" });
  }

  function openView(c: Contact) {
    setModal({ mode: "view", contact: c });
    setError(null);
  }

  function openEdit(c: Contact) {
    setDraft({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone ?? "",
      company: c.company ?? "",
      type: c.type ?? "Lead",
      status: c.status as ContactStatus,
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "AZ",
      zip: c.zip ?? "",
      notes: c.notes ?? "",
      tags: c.tags ?? [],
      source: c.source ?? "",
    });
    setTagInput("");
    setError(null);
    setModal({ mode: "edit", contact: c });
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || (draft.tags ?? []).includes(t)) { setTagInput(""); return; }
    setDraft((d) => ({ ...d, tags: [...(d.tags ?? []), t] }));
    setTagInput("");
  }

  function removeTag(t: string) {
    setDraft((d) => ({ ...d, tags: (d.tags ?? []).filter((x) => x !== t) }));
  }

  async function saveContact() {
    if (!draft.email) { setError("Email is required."); return; }
    setSaving(true);
    setError(null);
    try {
      if (modal?.mode === "add") {
        const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as Contact & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setContacts((prev) => [json, ...prev]);
      } else if (modal?.mode === "edit" && modal.contact) {
        const res = await fetch(`/api/contacts/${modal.contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as Contact & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setContacts((prev) => prev.map((c) => (c.id === json.id ? json : c)));
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed.");
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirm(null);
      if (modal?.contact?.id === id) closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const cols = ["first_name", "last_name", "email", "phone", "company", "type", "status", "city", "state", "tags"];
    const rows = [cols.join(","), ...filtered.map((c) => cols.map((k) => {
      const v = (c as Record<string, unknown>)[k];
      const s = Array.isArray(v) ? v.join("|") : String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    }).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const viewContact = modal?.contact;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">CRM</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {viewMode === "leads" ? "Leads" : "Contacts"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewMode === "leads" ? `${leadsCount} total leads` : `${contactsCount} total contacts`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}>Export CSV</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <FileUp className="h-3.5 w-3.5" /> Import
            </Button>
            <Button size="sm" variant="accent" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> {viewMode === "leads" ? "Add Lead" : "Add Contact"}
            </Button>
          </div>
        </div>

        {/* Contacts / Leads tabs */}
        <div className="mt-4 flex gap-0 border-b border-border">
          <button
            type="button"
            onClick={() => { setViewMode("contacts"); setTypeFilter("all"); setPage(1); }}
            className={cn("border-b-2 px-4 pb-2.5 pt-1 text-sm font-medium transition -mb-px",
              viewMode === "contacts" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Contacts
            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]",
              viewMode === "contacts" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
            )}>{contactsCount}</span>
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("leads"); setTypeFilter("all"); setPage(1); }}
            className={cn("border-b-2 px-4 pb-2.5 pt-1 text-sm font-medium transition -mb-px",
              viewMode === "leads" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Leads
            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]",
              viewMode === "leads" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
            )}>{leadsCount}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={viewMode === "leads" ? "Search leads..." : "Search name, email, phone..."}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          {viewMode === "contacts" && (
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="w-44 [&>button]:h-8"
            >
              <option value="all">All Types</option>
              {CONTACT_ONLY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          )}
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-44 [&>button]:h-8"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="w-32 [&>button]:h-8"
          >
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Email</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Phone</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">Company</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Type</th>
              <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tags</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageContacts.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No contacts found.</td></tr>
            )}
            {pageContacts.map((c) => (
              <tr key={c.id} className="transition hover:bg-muted/30 cursor-pointer" onClick={() => openView(c)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{initials(c)}</div>
                    <span className="font-medium">{fullName(c)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.phone ?? "--"}</td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{c.company ?? "--"}</td>
                <td className="px-4 py-3">
                  {c.type ? <Badge tone={TYPE_TONES[c.type] ?? "default"}>{c.type}</Badge> : <span className="text-muted-foreground">--</span>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                    ))}
                    {(c.tags ?? []).length > 2 && <span className="text-[11px] text-muted-foreground">+{(c.tags ?? []).length - 2}</span>}
                  </div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>{filtered.length} {viewMode === "leads" ? "leads" : "contacts"}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="text-xs">{page} / {totalPages}</span>
            <button type="button" className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal?.mode === "view" && viewContact && (
        <Modal title={fullName(viewContact)} onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent">{initials(viewContact)}</div>
              <div>
                <div className="text-lg font-semibold">{fullName(viewContact)}</div>
                {viewContact.company && <div className="text-sm text-muted-foreground">{viewContact.company}</div>}
                <div className="mt-1 flex gap-2">
                  {viewContact.type && <Badge tone={TYPE_TONES[viewContact.type] ?? "default"}>{viewContact.type}</Badge>}
                  <Badge tone={statusTone(viewContact.status)}>{viewContact.status}</Badge>
                </div>
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={viewContact.email} />
              <InfoRow icon={Phone} label="Phone" value={viewContact.phone ?? "--"} />
              <InfoRow icon={Building2} label="Company" value={viewContact.company ?? "--"} />
              <InfoRow icon={User} label="Source" value={viewContact.source ?? "--"} />
              {(viewContact.city || viewContact.state) && (
                <InfoRow icon={Building2} label="Location" value={[viewContact.city, viewContact.state, viewContact.zip].filter(Boolean).join(", ")} />
              )}
            </div>
            {(viewContact.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(viewContact.tags ?? []).map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><Tag className="h-3 w-3" />{t}</span>
                ))}
              </div>
            )}
            {viewContact.notes && (
              <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">{viewContact.notes}</div>
            )}
            <ContactQuickActions contact={viewContact} onAction={(type) => setContactAction({ type, contact: viewContact })} />
            <div className="flex items-center justify-between gap-2 pt-2">
              {viewMode === "leads" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-accent border-accent/40 hover:bg-accent/5"
                  onClick={() => { closeModal(); setConvertLead(viewContact); }}>
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Convert Lead
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => { closeModal(); setTimeout(() => openEdit(viewContact), 50); }}>Edit</Button>
                <Button size="sm" variant="outline" className="text-destructive hover:border-destructive" onClick={() => setDeleteConfirm(viewContact.id)}>Delete</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Modal */}
      {(modal?.mode === "add" || modal?.mode === "edit") && (
        <Modal title={modal.mode === "add" ? "Add Contact" : "Edit Contact"} onClose={closeModal} wide>
          <div className="space-y-4">
            {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First Name" required>
                <input className={inputCls} value={draft.first_name} onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))} />
              </Field>
              <Field label="Last Name">
                <input className={inputCls} value={draft.last_name} onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))} />
              </Field>
              <Field label="Email" required>
                <input type="email" className={inputCls} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <input type="tel" className={inputCls} value={draft.phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              </Field>
              <Field label="Company">
                <input className={inputCls} value={draft.company ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))} />
              </Field>
              <Field label="Job Title / Source">
                <input className={inputCls} value={draft.source ?? ""} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} />
              </Field>
              <Field label="Type">
                <Select value={draft.type ?? "Lead"} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ContactType }))}>
                  {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City" className="sm:col-span-1">
                <input className={inputCls} value={draft.city ?? ""} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
              </Field>
              <Field label="State">
                <Select value={draft.state ?? "AZ"} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Zip">
                <input className={inputCls} value={draft.zip ?? ""} onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value }))} />
              </Field>
            </div>
            <Field label="Address">
              <input className={inputCls} value={draft.address ?? ""} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
            </Field>
            <Field label="Tags">
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
                {(draft.tags ?? []).map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {t}
                    <button type="button" onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input
                  className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                />
              </div>
            </Field>
            <Field label="Notes">
              <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void saveContact()} disabled={saving}>
                {saving ? "Saving..." : modal.mode === "add" ? "Add Contact" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(imported) => {
            setShowImport(false);
            // Reload contacts list after import
            fetch("/api/contacts")
              .then((r) => r.json())
              .then((data: Contact[]) => setContacts(data))
              .catch(() => null);
            alert(`Successfully imported ${imported} contact${imported !== 1 ? "s" : ""}.`);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="Delete Contact" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-muted-foreground">This will permanently delete the contact and cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)} disabled={saving}>Cancel</Button>
            <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => void confirmDelete(deleteConfirm)} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Modal>
      )}

      {contactAction && (
        <ContactActionModal
          action={contactAction.type}
          contact={contactAction.contact}
          onClose={() => setContactAction(null)}
        />
      )}

      {convertLead && (
        <ConvertLeadModal
          contact={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={(updated) => {
            setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setConvertLead(null);
          }}
        />
      )}
    </div>
  );
}

// --- Shared sub-components -----------------------------------

const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function ContactQuickActions({ contact, onAction }: { contact: Contact; onAction: (type: "call" | "sms" | "email") => void }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</div>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!contact.phone} onClick={() => onAction("call")}>
          <Phone className="h-3.5 w-3.5" /> Call
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!contact.phone} onClick={() => onAction("sms")}>
          <Mail className="h-3.5 w-3.5" /> Text
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!contact.email} onClick={() => onAction("email")}>
          <Mail className="h-3.5 w-3.5" /> Email
        </Button>
      </div>
    </div>
  );
}

function ContactActionModal({
  action,
  contact,
  onClose,
}: {
  action: "call" | "sms" | "email";
  contact: Contact;
  onClose: () => void;
}) {
  const [message, setMessage] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Template state (email only)
  const [templates, setTemplates] = React.useState<{ id: string; name: string; subject: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<{ id: string; name: string; subject: string; html: string } | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const templateMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (action !== "email") return;
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((data: { templates?: { id: string; name: string; subject: string; status: string }[] }) => {
        setTemplates((data.templates ?? []).filter((t) => t.status === "active"));
      })
      .catch(() => {});
  }, [action]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const contactName = fullName(contact);
  const title = action === "call" ? `Call ${contactName}` : action === "sms" ? `Text ${contactName}` : `Email ${contactName}`;

  async function submit() {
    const body = selectedTemplate ? selectedTemplate.html : message;
    setBusy(true); setError(null); setNotice(null);
    try {
      const payload =
        action === "call"
          ? { channel: "call", to: contact.phone, contact_id: contact.id }
          : action === "sms"
            ? { channel: "sms", to: contact.phone, body: message, contact_id: contact.id }
            : { channel: "email", to: contact.email, subject, body, contact_id: contact.id };

      if (action === "sms" && !message) throw new Error("Message is required.");
      if (action === "email" && !subject) throw new Error("Subject is required.");
      if (action === "email" && !body) throw new Error("Message or template body is required.");

      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setNotice(action === "call" ? "Call queued. Answer your phone to connect." : "Message sent.");
      if (action !== "call") setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        {notice ? <div className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</div> : null}

        {action === "call" ? (
          <>
            <Field label="Recipient">
              <input className={inputCls} value={contact.phone ?? ""} readOnly />
            </Field>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
              This call will be placed from the Constructed Matter Twilio number, +1 480 906 4400.
            </div>
          </>
        ) : (
          <>
            <Field label={action === "email" ? "Email" : "Phone"}>
              <input className={inputCls} value={action === "email" ? contact.email : contact.phone ?? ""} readOnly />
            </Field>
            {action === "email" ? (
              <Field label="Subject" required>
                <div className="flex gap-2">
                  <input
                    className={cn(inputCls, "flex-1")}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                  {templates.length > 0 && (
                    <div className="relative shrink-0" ref={templateMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowTemplateMenu((v) => !v)}
                        className={cn(
                          "flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition",
                          selectedTemplate
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                        )}
                      >
                        <LayoutTemplate className="h-3 w-3" />
                        {selectedTemplate ? selectedTemplate.name : "Template"}
                        <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplateMenu && "rotate-180")} />
                      </button>
                      {showTemplateMenu && (
                        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                          {selectedTemplate && (
                            <button
                              type="button"
                              onClick={() => { setSelectedTemplate(null); setShowTemplateMenu(false); }}
                              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                            >
                              <X className="h-3 w-3" /> Clear template
                            </button>
                          )}
                          <div className="max-h-48 overflow-y-auto py-1">
                            {templates.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setShowTemplateMenu(false);
                                  setLoadingTemplate(true);
                                  fetch(`/api/admin/email-templates/${t.id}`)
                                    .then((r) => r.json() as Promise<{ template: { id: string; name: string; subject: string; html: string } }>)
                                    .then((data) => {
                                      setSelectedTemplate({ id: data.template.id, name: data.template.name, subject: data.template.subject, html: data.template.html ?? "" });
                                      if (data.template.subject) setSubject(data.template.subject);
                                      setShowTemplatePreview(true);
                                    })
                                    .catch(() => setError("Failed to load template."))
                                    .finally(() => setLoadingTemplate(false));
                                }}
                                className={cn(
                                  "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-xs transition hover:bg-muted",
                                  selectedTemplate?.id === t.id && "bg-accent/5 text-accent"
                                )}
                              >
                                <span className="font-semibold">{t.name}</span>
                                {t.subject && <span className="truncate text-muted-foreground">{t.subject}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Field>
            ) : null}

            {/* Template preview or message textarea */}
            {action === "email" ? (
              loadingTemplate ? (
                <Field label="Loading template...">
                  <div className="flex h-16 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
                    Loading...
                  </div>
                </Field>
              ) : selectedTemplate ? (
                <Field label="Template">
                  <div className="overflow-hidden rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        Using: <strong className="text-foreground">{selectedTemplate.name}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTemplatePreview((v) => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-3 w-3" /> {showTemplatePreview ? "Hide" : "Show"} preview
                      </button>
                    </div>
                    {showTemplatePreview && (
                      <iframe
                        srcDoc={selectedTemplate.html || "<p style='padding:16px;color:#888;font-family:sans-serif;font-size:13px'>No HTML content.</p>"}
                        className="h-48 w-full bg-white"
                        title="Template preview"
                        sandbox="allow-same-origin"
                      />
                    )}
                  </div>
                </Field>
              ) : (
                <Field label="Message" required>
                  <textarea className={cn(inputCls, "min-h-[120px] resize-none py-2")} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message..." />
                </Field>
              )
            ) : (
              <Field label="Message" required>
                <textarea className={cn(inputCls, "min-h-[120px] resize-none py-2")} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void submit()} disabled={busy}>
            {action === "call" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {busy ? "Working..." : action === "call" ? "Start Call" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Import Modal --------------------------------------------

const REQUIRED_FIELDS = [
  { name: "first_name", desc: "Contact's first name" },
  { name: "last_name",  desc: "Contact's last name" },
  { name: "email",      desc: "Unique email address" },
];
const OPTIONAL_FIELDS = [
  { name: "phone",    desc: "Phone number" },
  { name: "company",  desc: "Company or organization" },
  { name: "type",     desc: "Client | Lead | Vendor | Sub Contractor" },
  { name: "status",   desc: "active | inactive | archived  (default: active)" },
  { name: "address",  desc: "Street address" },
  { name: "city",     desc: "City" },
  { name: "state",    desc: "State abbreviation  (default: AZ)" },
  { name: "zip",      desc: "Zip code" },
  { name: "source",   desc: "Lead source" },
  { name: "notes",    desc: "Internal notes" },
  { name: "tags",     desc: 'Pipe-separated tags  e.g. "VIP|Phoenix|2026"' },
];

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const vals: string[] = [];
    let cur = "", inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { vals.push(cur); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  }).filter((r) => r.email);
}

function downloadTemplate() {
  const headers = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => f.name).join(",");
  const example = "Jane,Smith,jane@example.com,(602) 555-0100,Acme Corp,Client,active,123 Main St,Scottsdale,AZ,85251,Referral,Notes here,VIP|Phoenix";
  const blob = new Blob([headers + "\n" + example], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "contacts-template.csv"; a.click();
  URL.revokeObjectURL(url);
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (n: number) => void }) {
  const [tab, setTab] = React.useState<"guide" | "upload">("guide");
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = React.useState<"skip" | "overwrite">("skip");
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target?.result as string);
        if (parsed.length === 0) { setParseError("No valid rows found. Make sure your CSV has a header row and an email column."); setRows([]); return; }
        setRows(parsed); setParseError(null); setTab("upload");
      } catch { setParseError("Could not parse file. Please use the CSV template."); }
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const contacts = rows.map((r) => ({
        first_name: r.first_name || r["first name"] || "",
        last_name:  r.last_name  || r["last name"]  || "",
        email:      r.email || "",
        phone:      r.phone || "",
        company:    r.company || "",
        type:       (["Client","Lead","Vendor","Sub Contractor"].includes(r.type) ? r.type : "Lead") as ContactType,
        status:     (["active","inactive","archived"].includes(r.status) ? r.status : "active") as ContactStatus,
        address:    r.address || "",
        city:       r.city || "",
        state:      r.state || "AZ",
        zip:        r.zip || "",
        source:     r.source || "",
        notes:      r.notes || "",
        tags:       r.tags ? r.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
      }));
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts, duplicateAction }),
      });
      const json = await res.json() as { imported: number; skipped: number; errors: string[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
      if (json.errors.length === 0) onImported(json.imported);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed.");
    } finally { setImporting(false); }
  }

  const previewCols = ["first_name", "last_name", "email", "type", "company"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Import Contacts</h2>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card">
          {(["guide", "upload"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn("px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px",
                tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t === "guide" ? "Field Reference" : "Upload CSV"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "guide" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Required</div>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {REQUIRED_FIELDS.map((f) => (
                      <div key={f.name} className="flex items-start gap-3 px-3 py-2">
                        <code className="mt-0.5 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-mono text-accent">{f.name}</code>
                        <span className="text-xs text-muted-foreground">{f.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Optional</div>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {OPTIONAL_FIELDS.map((f) => (
                      <div key={f.name} className="flex items-start gap-3 px-3 py-2">
                        <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">{f.name}</code>
                        <span className="text-xs text-muted-foreground">{f.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 text-sm text-muted-foreground">Download the CSV template with all columns pre-filled and one example row.</div>
                <Button size="sm" variant="outline" onClick={downloadTemplate}>Download Template</Button>
              </div>
              <p className="text-xs text-muted-foreground">Columns can be in any order. Extra columns are ignored. The <code className="rounded bg-muted px-1 text-[11px]">email</code> column is used to detect duplicates.</p>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4">
              {parseError && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{parseError}</div>}

              {result ? (
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <div className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Import complete</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {result.imported} imported | {result.skipped} skipped
                    {result.errors.length > 0 && <div className="mt-1 text-destructive">{result.errors.slice(0, 3).join(", ")}</div>}
                  </div>
                </div>
              ) : (
                <>
                  <label className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 text-sm text-muted-foreground transition hover:border-accent hover:bg-accent/5">
                    <FileUp className="h-6 w-6" />
                    <span>{rows.length > 0 ? `${rows.length} rows loaded -- select a different file` : "Click to select a CSV file"}</span>
                    <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
                  </label>

                  {rows.length > 0 && (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full border-collapse text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              {previewCols.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold text-muted-foreground">{c}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {rows.slice(0, 5).map((r, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                {previewCols.map((c) => <td key={c} className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">{r[c] || "--"}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rows.length > 5 && <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">+ {rows.length - 5} more rows</div>}
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                        <span className="text-sm font-medium">{rows.length} contact{rows.length !== 1 ? "s" : ""} ready</span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">Duplicates:</span>
                          {(["skip", "overwrite"] as const).map((opt) => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="dup" checked={duplicateAction === opt} onChange={() => setDuplicateAction(opt)} className="accent-accent" />
                              <span className="capitalize">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          {tab === "guide"
            ? <Button size="sm" variant="accent" onClick={() => setTab("upload")}><FileUp className="h-3.5 w-3.5" /> Upload CSV</Button>
            : <Button size="sm" variant="accent" onClick={() => void doImport()} disabled={rows.length === 0 || importing || !!result}>
                {importing ? "Importing..." : `Import ${rows.length} Contact${rows.length !== 1 ? "s" : ""}`}
              </Button>
          }
        </div>
      </div>
    </div>
  );
}

// --- Convert Lead Modal --------------------------------------

function ConvertLeadModal({
  contact,
  onClose,
  onConverted,
}: {
  contact: Contact;
  onClose: () => void;
  onConverted: (updated: Contact) => void;
}) {
  const [contactType, setContactType] = React.useState<ContactType>("Client");
  const [staffRole, setStaffRole] = React.useState<StaffRole>("viewer");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function convertToContact() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: contactType }),
      });
      const json = await res.json() as Contact & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onConverted(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally { setBusy(false); }
  }

  async function convertToStaff() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/convert-to-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_slug: staffRole }),
      });
      const json = await res.json() as Contact & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onConverted(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally { setBusy(false); }
  }

  const name = fullName(contact);

  return (
    <Modal title={`Convert Lead -- ${name}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <p className="text-sm text-muted-foreground">Choose how to convert <strong className="text-foreground">{name}</strong>. This will update their type in the system.</p>

        {/* Convert to Contact */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Convert to Contact</div>
              <div className="text-xs text-muted-foreground">Change their type and keep all existing information.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Field label="New Type" className="flex-1">
              <Select value={contactType} onChange={(e) => setContactType(e.target.value as ContactType)}>
                {CONTACT_ONLY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <div className="mt-5">
              <Button size="sm" variant="accent" onClick={() => void convertToContact()} disabled={busy}>
                Convert
              </Button>
            </div>
          </div>
        </div>

        {/* Convert to Staff User */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Convert to Staff User</div>
              <div className="text-xs text-muted-foreground">Creates a staff account with status "invited". They can log in once their auth account is set up in Supabase.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Field label="Staff Role" className="flex-1">
              <Select value={staffRole} onChange={(e) => setStaffRole(e.target.value as StaffRole)}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                ))}
              </Select>
            </Field>
            <div className="mt-5">
              <Button size="sm" variant="accent" onClick={() => void convertToStaff()} disabled={busy}>
                Create Staff
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
