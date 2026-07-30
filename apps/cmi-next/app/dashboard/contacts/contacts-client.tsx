"use client";

import * as React from "react";
import {
  Archive,
  ArrowRightLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Columns3,
  Eye,
  FileUp,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mail,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Table as TableIcon,
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

const CONTACT_TYPES: ContactType[] = ["Lead", "Client", "Prospect", "Customer", "Vendor", "Sub Contractor", "Designer", "Other"];
const CONTACT_ONLY_TYPES: ContactType[] = ["Client", "Prospect", "Customer", "Vendor", "Sub Contractor", "Designer", "Other"];

type ContactView = "table" | "list" | "cards" | "kanban" | "calendar";
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
  // Bulk selection + expanded-modal state.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = React.useState<ContactType | "">("");
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [modalFull, setModalFull] = React.useState(false);
  const [contactView, setContactView] = React.useState<ContactView>("table");

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
    setModalFull(false);
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

  // ── Bulk selection ──
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function clearSelection() { setSelected(new Set()); }

  async function applyBulk(patch: { type?: ContactType; status?: string }) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, patch }),
      });
      const json = await res.json() as { updated?: Contact[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const byId = new Map((json.updated ?? []).map((c) => [c.id, c]));
      setContacts((prev) => prev.map((c) => byId.get(c.id) ?? c));
      clearSelection();
      setBulkType("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  // Single-record update (archive from the modal, etc).
  async function applyBulkOne(id: string, patch: { type?: ContactType; status?: string }) {
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const json = await res.json() as Contact & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setContacts((prev) => prev.map((c) => (c.id === json.id ? json : c)));
      if (modal?.contact?.id === id) setModal({ mode: "view", contact: json });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
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
          <div className="ml-auto inline-flex rounded-md border border-border p-0.5">
            {([["table", TableIcon], ["list", List], ["cards", LayoutGrid], ["kanban", Columns3], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
              <button key={v} type="button" title={v} onClick={() => setContactView(v)} className={cn("inline-flex h-7 w-7 items-center justify-center rounded", contactView === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /></button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent/5 px-4 py-2.5 md:px-6">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Change type to</span>
            <Select value={bulkType} onChange={(e) => setBulkType(e.target.value as ContactType)} className="w-40 [&>button]:h-8">
              <option value="">Select…</option>
              {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Button size="sm" variant="accent" disabled={!bulkType || bulkBusy} onClick={() => void applyBulk({ type: bulkType as ContactType })}>
              {bulkBusy ? "Applying…" : "Apply"}
            </Button>
          </div>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk({ status: "archived" })}>
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {/* Non-table views */}
      {contactView !== "table" && (
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {contactView === "list" && <ContactListView contacts={pageContacts} selected={selected} onToggle={toggleSelect} onOpen={openView} onEdit={openEdit} onAction={(type, contact) => setContactAction({ type, contact })} />}
          {contactView === "cards" && <ContactCardsView contacts={pageContacts} selected={selected} onToggle={toggleSelect} onOpen={openView} onEdit={openEdit} onAction={(type, contact) => setContactAction({ type, contact })} />}
          {contactView === "kanban" && <ContactKanbanView contacts={filtered} onOpen={openView} onAction={(type, contact) => setContactAction({ type, contact })} />}
          {contactView === "calendar" && <ContactCalendarView contacts={filtered} onOpen={openView} />}
        </div>
      )}

      {/* Table */}
      {contactView === "table" && (
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={pageContacts.length > 0 && pageContacts.every((c) => selected.has(c.id))}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) pageContacts.forEach((c) => n.add(c.id));
                      else pageContacts.forEach((c) => n.delete(c.id));
                      return n;
                    });
                  }}
                />
              </th>
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
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">No contacts found.</td></tr>
            )}
            {pageContacts.map((c) => (
              <tr key={c.id} className={cn("transition hover:bg-muted/30 cursor-pointer", selected.has(c.id) && "bg-accent/5")} onClick={() => openView(c)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${fullName(c)}`}
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                  />
                </td>
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
                  <div className="flex items-center justify-end gap-0.5">
                    {c.phone && (
                      <>
                        <QuickIcon label="Call" onClick={() => setContactAction({ type: "call", contact: c })}><Phone className="h-4 w-4" /></QuickIcon>
                        <QuickIcon label="Text" onClick={() => setContactAction({ type: "sms", contact: c })}><MessageSquare className="h-4 w-4" /></QuickIcon>
                      </>
                    )}
                    <QuickIcon label="Email" onClick={() => setContactAction({ type: "email", contact: c })}><Mail className="h-4 w-4" /></QuickIcon>
                    <QuickIcon label="Edit" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></QuickIcon>
                    <QuickIcon label="More" onClick={() => openView(c)}><MoreHorizontal className="h-4 w-4" /></QuickIcon>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Pagination (paginated views only) */}
      {contactView !== "kanban" && contactView !== "calendar" && totalPages > 1 && (
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
        <Modal
          title={fullName(viewContact)}
          onClose={closeModal}
          fullscreen={modalFull}
          headerExtra={
            <button
              type="button"
              title={modalFull ? "Exit full screen" : "Expand to full screen"}
              aria-label={modalFull ? "Exit full screen" : "Expand to full screen"}
              onClick={() => setModalFull((v) => !v)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {modalFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          }
        >
          <div className="space-y-4">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-1">
              {viewContact.phone && (
                <>
                  <QuickPill icon={Phone} label="Call" onClick={() => setContactAction({ type: "call", contact: viewContact })} />
                  <QuickPill icon={MessageSquare} label="Text" onClick={() => setContactAction({ type: "sms", contact: viewContact })} />
                </>
              )}
              <QuickPill icon={Mail} label="Email" onClick={() => setContactAction({ type: "email", contact: viewContact })} />
              <QuickPill icon={Pencil} label="Edit" onClick={() => { closeModal(); setTimeout(() => openEdit(viewContact), 50); }} />
              <QuickPill icon={Archive} label="Archive" onClick={() => void applyBulkOne(viewContact.id, { status: "archived" })} />
              <QuickPill icon={Trash2} label="Delete" danger onClick={() => setDeleteConfirm(viewContact.id)} />
            </div>

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

            {/* Imported / enrichment details (e.g. from a lead CSV) */}
            {viewContact.metadata && Object.keys(viewContact.metadata).length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Imported Details</div>
                <div className="grid gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
                  {Object.entries(viewContact.metadata)
                    .filter(([, v]) => String(v ?? "").trim())
                    .map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <div className="text-[11px] text-muted-foreground">{k}</div>
                        <div className="truncate font-medium" title={String(v)}>
                          {/^https?:\/\//.test(String(v))
                            ? <a href={String(v)} target="_blank" rel="noreferrer" className="text-accent hover:underline">{String(v)}</a>
                            : String(v)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {viewMode === "leads" && (
              <div className="pt-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-accent border-accent/40 hover:bg-accent/5"
                  onClick={() => { closeModal(); setConvertLead(viewContact); }}>
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Convert Lead
                </Button>
              </div>
            )}
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

function QuickPill({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted",
        danger ? "text-destructive hover:border-destructive/50" : "text-foreground hover:border-accent/50 hover:text-accent",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function QuickIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-accent"
    >
      {children}
    </button>
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

// Original header casing is preserved so unmapped columns can be shown in the
// expanded profile with readable labels. Core-field lookups are case-insensitive
// (see mapRowToDraft), so both our own template and a ZoomInfo export work.
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const splitLine = (line: string) => {
    const vals: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } // escaped ""
        else inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) { vals.push(cur); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur);
    return vals;
  };
  const headers = splitLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  });
}

// Map a raw CSV row (any header casing / ZoomInfo layout) to a contact draft.
// Known columns fill core fields; everything else non-empty goes to metadata.
const CORE_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "first_name", "firstname"],
  last_name: ["last name", "last_name", "lastname"],
  email: ["email address", "email", "email_address", "e-mail"],
  phone: ["mobile phone", "direct phone number", "phone", "phone number", "mobile", "cell"],
  company: ["company name", "company", "organization"],
  address: ["person street", "street", "address", "street address"],
  city: ["person city", "city"],
  state: ["person state", "state"],
  zip: ["person zip code", "zip", "zip code", "postal code"],
  source: ["job title", "title", "source", "job_title"],
  type: ["type"],
  status: ["status"],
  notes: ["notes", "note"],
  tags: ["tags"],
};

function mapRowToDraft(row: Record<string, string>): ContactDraft {
  const norm = (h: string) => h.trim().toLowerCase();
  const byNorm: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) byNorm[norm(k)] = v;
  const pick = (field: string) => {
    for (const a of CORE_ALIASES[field] ?? []) if (byNorm[a]?.trim()) return byNorm[a].trim();
    return "";
  };
  const consumed = new Set(Object.values(CORE_ALIASES).flat());

  // Everything not consumed by a core field, non-empty, keyed by original header.
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!v?.trim()) continue;
    if (consumed.has(norm(k))) continue;
    metadata[k] = v.trim();
  }

  const type = pick("type");
  const status = pick("status");
  const tags = pick("tags");
  return {
    first_name: pick("first_name"),
    last_name: pick("last_name"),
    email: pick("email"),
    phone: pick("phone"),
    company: pick("company"),
    type: (CONTACT_TYPES as string[]).includes(type) ? (type as ContactType) : "Lead",
    status: (["active", "inactive", "archived"].includes(status) ? status : "active") as ContactStatus,
    address: pick("address"),
    city: pick("city"),
    state: pick("state") || "AZ",
    zip: pick("zip"),
    source: pick("source"),
    notes: pick("notes"),
    tags: tags ? tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
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
      const contacts = rows.map(mapRowToDraft).filter((c) => c.email);
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

  // Importable rows (those that resolve to an email), mapped for preview + count.
  const drafts = React.useMemo(() => rows.map(mapRowToDraft).filter((c) => c.email), [rows]);
  const previewCols: { key: keyof ContactDraft; label: string }[] = [
    { key: "first_name", label: "first name" },
    { key: "last_name", label: "last name" },
    { key: "email", label: "email" },
    { key: "company", label: "company" },
    { key: "phone", label: "phone" },
  ];

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
                              {previewCols.map((c) => <th key={c.key} className="px-3 py-2 text-left font-semibold text-muted-foreground">{c.label}</th>)}
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">extra fields</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {drafts.slice(0, 5).map((d, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                {previewCols.map((c) => <td key={c.key} className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">{String(d[c.key] ?? "") || "--"}</td>)}
                                <td className="px-3 py-2 text-muted-foreground">{d.metadata ? `${Object.keys(d.metadata).length} fields` : "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {drafts.length > 5 && <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">+ {drafts.length - 5} more rows</div>}
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                        <span className="text-sm font-medium">{drafts.length} contact{drafts.length !== 1 ? "s" : ""} ready{rows.length !== drafts.length ? ` (${rows.length - drafts.length} skipped — no email)` : ""}</span>
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
            : <Button size="sm" variant="accent" onClick={() => void doImport()} disabled={drafts.length === 0 || importing || !!result}>
                {importing ? "Importing..." : `Import ${drafts.length} Contact${drafts.length !== 1 ? "s" : ""}`}
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

// --- Alternate views (list / cards / kanban / calendar) ------

type ActionFn = (type: "call" | "sms" | "email", contact: Contact) => void;

function RowQuickIcons({ c, onEdit, onAction }: { c: Contact; onEdit: (c: Contact) => void; onAction: ActionFn }) {
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {c.phone && (
        <>
          <QuickIcon label="Call" onClick={() => onAction("call", c)}><Phone className="h-4 w-4" /></QuickIcon>
          <QuickIcon label="Text" onClick={() => onAction("sms", c)}><MessageSquare className="h-4 w-4" /></QuickIcon>
        </>
      )}
      <QuickIcon label="Email" onClick={() => onAction("email", c)}><Mail className="h-4 w-4" /></QuickIcon>
      <QuickIcon label="Edit" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></QuickIcon>
    </div>
  );
}

function ContactListView({ contacts, selected, onToggle, onOpen, onEdit, onAction }: {
  contacts: Contact[]; selected: Set<string>; onToggle: (id: string) => void; onOpen: (c: Contact) => void; onEdit: (c: Contact) => void; onAction: ActionFn;
}) {
  if (contacts.length === 0) return <EmptyState />;
  return (
    <div className="space-y-2">
      {contacts.map((c) => (
        <div key={c.id} className={cn("flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition hover:border-accent/40", selected.has(c.id) && "border-accent/50 bg-accent/5")}>
          <input type="checkbox" aria-label={`Select ${fullName(c)}`} className="h-4 w-4 accent-[var(--accent)]" checked={selected.has(c.id)} onChange={() => onToggle(c.id)} />
          <button type="button" onClick={() => onOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{initials(c)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{fullName(c)}</div>
              <div className="truncate text-xs text-muted-foreground">{c.email}{c.company ? ` · ${c.company}` : ""}</div>
            </div>
            {c.type && <Badge tone={TYPE_TONES[c.type] ?? "default"}>{c.type}</Badge>}
          </button>
          <RowQuickIcons c={c} onEdit={onEdit} onAction={onAction} />
        </div>
      ))}
    </div>
  );
}

function ContactCardsView({ contacts, selected, onToggle, onOpen, onEdit, onAction }: {
  contacts: Contact[]; selected: Set<string>; onToggle: (id: string) => void; onOpen: (c: Contact) => void; onEdit: (c: Contact) => void; onAction: ActionFn;
}) {
  if (contacts.length === 0) return <EmptyState />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((c) => (
        <div key={c.id} className={cn("flex flex-col rounded-xl border border-border bg-background p-4 transition hover:border-accent/40", selected.has(c.id) && "border-accent/50 bg-accent/5")}>
          <div className="flex items-start justify-between">
            <button type="button" onClick={() => onOpen(c)} className="flex min-w-0 items-center gap-2.5 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{initials(c)}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{fullName(c)}</div>
                {c.company && <div className="truncate text-xs text-muted-foreground">{c.company}</div>}
              </div>
            </button>
            <input type="checkbox" aria-label={`Select ${fullName(c)}`} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" checked={selected.has(c.id)} onChange={() => onToggle(c.id)} />
          </div>
          <button type="button" onClick={() => onOpen(c)} className="mt-3 min-w-0 space-y-1 text-left">
            <div className="truncate text-xs text-muted-foreground">{c.email}</div>
            {c.phone && <div className="truncate text-xs text-muted-foreground">{c.phone}</div>}
          </button>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            {c.type ? <Badge tone={TYPE_TONES[c.type] ?? "default"}>{c.type}</Badge> : <span />}
            <RowQuickIcons c={c} onEdit={onEdit} onAction={onAction} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactKanbanView({ contacts, onOpen, onAction }: { contacts: Contact[]; onOpen: (c: Contact) => void; onAction: ActionFn }) {
  // Columns by type — the primary way leads move through the pipeline.
  const cols = CONTACT_TYPES.map((t) => ({ type: t, items: contacts.filter((c) => (c.type ?? "Other") === t) })).filter((c) => c.items.length > 0);
  if (contacts.length === 0) return <EmptyState />;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cols.map((col) => (
        <div key={col.type} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">{col.type}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {col.items.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-background p-2.5">
                <button type="button" onClick={() => onOpen(c)} className="flex w-full items-center gap-2 text-left">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">{initials(c)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{fullName(c)}</div>
                    {c.company && <div className="truncate text-[11px] text-muted-foreground">{c.company}</div>}
                  </div>
                </button>
                <div className="mt-2 flex justify-end"><RowQuickIcons c={c} onEdit={onOpen} onAction={onAction} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactCalendarView({ contacts, onOpen }: { contacts: Contact[]; onOpen: (c: Contact) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  // Place contacts on the day they were added (created_at, fallback last_activity).
  const byDay = React.useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const d = new Date(c.created_at ?? c.last_activity ?? "");
      if (Number.isNaN(d.getTime())) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return map;
  }, [contacts]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date();
  const step = (delta: number) => setCursor((cur) => { const m = cur.m + delta; return { y: cur.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-24 bg-background" />;
          const items = byDay.get(`${cursor.y}-${cursor.m}-${day}`) ?? [];
          const isToday = today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === day;
          return (
            <div key={day} className="min-h-24 bg-background p-1.5">
              <div className={cn("mb-1 text-[11px] font-medium", isToday ? "text-accent" : "text-muted-foreground")}>{day}</div>
              <div className="space-y-1">
                {items.slice(0, 4).map((c) => (
                  <button key={c.id} type="button" onClick={() => onOpen(c)} title={fullName(c)} className="block w-full truncate rounded bg-accent/10 px-1.5 py-0.5 text-left text-[10px] text-accent hover:bg-accent/20">{fullName(c)}</button>
                ))}
                {items.length > 4 && <div className="px-1.5 text-[10px] text-muted-foreground">+{items.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">No contacts found.</div>;
}

function Modal({ title, onClose, wide, fullscreen, headerExtra, children }: { title: string; onClose: () => void; wide?: boolean; fullscreen?: boolean; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 flex justify-center", fullscreen ? "p-0 sm:p-4" : "items-center p-4")}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative z-10 overflow-y-auto border border-border bg-card shadow-xl",
        fullscreen ? "h-full w-full max-w-none rounded-none sm:h-[92vh] sm:rounded-xl" : cn("max-h-[90vh] w-full rounded-xl", wide ? "max-w-2xl" : "max-w-lg"),
      )}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {headerExtra}
            <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className={cn("p-5", fullscreen && "mx-auto max-w-4xl")}>{children}</div>
      </div>
    </div>
  );
}
