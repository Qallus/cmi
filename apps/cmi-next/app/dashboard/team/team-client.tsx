"use client";

import * as React from "react";
import {
  Columns2, GripVertical, LayoutGrid, List, Mail, Phone, Plus, Table2, User, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeamMember, TeamMemberDraft } from "@/lib/team/types";

type ViewMode = "grid" | "list" | "table" | "kanban";

function safeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  if (t.startsWith("{") || t.startsWith("[")) return null;
  return t || null;
}

const EMPTY_DRAFT: TeamMemberDraft = {
  name: "", slug: "", role: "", department: "", bio: "", tagline: "",
  email: "", phone: "", profile_photo: "", secondary_photo: "",
  attributes: [], availability: "", sort_order: 100, status: "active",
};

// ── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ member, hovered, size = "card" }: {
  member: TeamMember; hovered?: boolean; size?: "card" | "kanban" | "sm" | "xs";
}) {
  const isSecondary = !!(hovered && member.secondary_photo);
  const src = isSecondary ? member.secondary_photo : member.profile_photo;
  // Primary photos are portrait headshots → anchor top to show face.
  // Secondary photos are often landscape/group shots → center for best framing.
  const objectPos = isSecondary ? "object-center" : "object-top";

  if (size === "xs") return src
    ? <img src={src} alt={member.name} className={cn("h-8 w-8 rounded-full object-cover", objectPos)} />
    : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4 text-muted-foreground/50" /></div>;

  if (size === "sm") return src
    ? <img src={src} alt={member.name} className={cn("h-12 w-12 rounded-full object-cover", objectPos)} />
    : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><User className="h-5 w-5 text-muted-foreground/50" /></div>;

  const h = size === "kanban" ? "h-40" : "h-[475px]";
  return (
    <div className={cn("relative overflow-hidden bg-muted", h)}>
      {src
        ? <img src={src} alt={member.name} className={cn("h-full w-full object-cover transition-all duration-300", objectPos)} />
        : <div className="flex h-full items-center justify-center"><User className="h-16 w-16 text-muted-foreground/30" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3">
        <div className="font-semibold text-white leading-snug">{member.name}</div>
        {member.role && <div className="text-xs text-white/75 mt-0.5">{member.role}</div>}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TeamClient({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = React.useState<TeamMember[]>(initialMembers);
  const [view, setView] = React.useState<ViewMode>("grid");
  const [modal, setModal] = React.useState<{ member?: TeamMember } | null>(null);
  const [draft, setDraft] = React.useState<TeamMemberDraft>(EMPTY_DRAFT);
  const [attrInput, setAttrInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  // Drag state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() { setDraft({ ...EMPTY_DRAFT }); setAttrInput(""); setError(null); setModal({}); }
  function openEdit(m: TeamMember) {
    setDraft({
      name: m.name, slug: m.slug ?? "", role: m.role ?? "", department: m.department ?? "",
      bio: safeText(m.bio) ?? "", tagline: safeText(m.tagline) ?? "",
      email: m.email ?? "", phone: m.phone ?? "",
      profile_photo: m.profile_photo ?? "", secondary_photo: m.secondary_photo ?? "",
      attributes: m.attributes ?? [], availability: m.availability ?? "",
      sort_order: m.sort_order, status: m.status,
    });
    setAttrInput(""); setError(null); setModal({ member: m });
  }
  function closeModal() { setModal(null); setError(null); }

  function addAttr() {
    const a = attrInput.trim();
    if (!a || (draft.attributes ?? []).includes(a)) { setAttrInput(""); return; }
    setDraft((d) => ({ ...d, attributes: [...(d.attributes ?? []), a] }));
    setAttrInput("");
  }

  async function save() {
    if (!draft.name) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    try {
      if (modal?.member) {
        const res = await fetch(`/api/team/${modal.member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as TeamMember & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setMembers((prev) => prev.map((m) => (m.id === json.id ? json : m)));
      } else {
        const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const json = await res.json() as TeamMember & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setMembers((prev) => [...prev, json]);
      }
      closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/team/${id}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setDeleteConfirm(null);
    } finally { setSaving(false); }
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragOverId) setDragOverId(id);
  }

  function onDragOverCol(e: React.DragEvent, col: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (col !== dragOverCol) setDragOverCol(col);
    setDragOverId(null);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
    setDragOverCol(null);
  }

  // Reorder by swapping dragged item to target position, then persist
  function onDrop(e: React.DragEvent, targetId: string, newDept?: string) {
    e.preventDefault();
    const fromId = draggingId;
    onDragEnd();
    if (!fromId || fromId === targetId) return;
    applyReorder(fromId, targetId, newDept);
  }

  // Drop on a kanban column header → move member to end of that column
  function onDropCol(e: React.DragEvent, toDept: string) {
    e.preventDefault();
    const fromId = draggingId;
    onDragEnd();
    if (!fromId) return;
    const from = members.find((m) => m.id === fromId);
    if (!from) return;
    const fromDept = from.department || "General";
    if (fromDept === toDept) return;

    // Move to end of target column
    const without = members.filter((m) => m.id !== fromId);
    const deptKey = toDept === "General" ? "" : toDept;
    const lastInCol = [...without].reverse().find((m) => (m.department || "General") === toDept);
    const insertAt = lastInCol ? without.findIndex((m) => m.id === lastInCol.id) + 1 : without.length;
    without.splice(insertAt, 0, { ...from, department: deptKey });
    persistReorder(without, fromId, deptKey);
  }

  function applyReorder(fromId: string, toId: string, newDept?: string) {
    const fromIdx = members.findIndex((m) => m.id === fromId);
    const toIdx = members.findIndex((m) => m.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...members];
    const [dragged] = next.splice(fromIdx, 1);
    const deptKey = newDept === "General" ? "" : (newDept ?? dragged.department);
    next.splice(toIdx, 0, { ...dragged, department: deptKey ?? "" });
    persistReorder(next, fromId, newDept !== undefined ? (deptKey ?? "") : undefined);
  }

  function persistReorder(ordered: TeamMember[], changedDeptId?: string, newDept?: string) {
    const withOrder = ordered.map((m, i) => ({ ...m, sort_order: i + 1 }));
    setMembers(withOrder);
    void Promise.all(
      withOrder
        .filter((m) => {
          const orig = members.find((o) => o.id === m.id);
          return orig && (orig.sort_order !== m.sort_order || (m.id === changedDeptId && newDept !== undefined));
        })
        .map((m) => {
          const body: Record<string, unknown> = { sort_order: m.sort_order };
          if (m.id === changedDeptId && newDept !== undefined) body.department = newDept;
          return fetch(`/api/team/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        })
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status === "inactive");
  const kanbanCols = React.useMemo(() => {
    const depts = Array.from(new Set(members.map((m) => m.department || "General")));
    return depts.map((dept) => ({
      dept,
      members: members.filter((m) => (m.department || "General") === dept),
    }));
  }, [members]);

  // ── Drag helpers per item ──────────────────────────────────────────────────

  const dragProps = (m: TeamMember, dept?: string) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => onDragStart(e, m.id),
    onDragOver: (e: React.DragEvent) => onDragOver(e, m.id),
    onDrop: (e: React.DragEvent) => onDrop(e, m.id, dept),
    onDragEnd,
  });

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">People</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">{active.length} active member{active.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-card p-0.5">
            {([["grid", LayoutGrid], ["list", List], ["table", Table2], ["kanban", Columns2]] as [ViewMode, React.ElementType][]).map(([v, Icon]) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={cn("flex h-7 w-7 items-center justify-center rounded text-xs transition", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}
                title={v.charAt(0).toUpperCase() + v.slice(1)}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Member</Button>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      {view === "grid" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((m) => (
              <div key={m.id} {...dragProps(m)}
                onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(null)}
                onClick={() => openEdit(m)}
                className={cn(
                  "cursor-grab overflow-hidden rounded-xl border bg-card transition active:cursor-grabbing",
                  draggingId === m.id ? "opacity-40 scale-95" : "opacity-100",
                  dragOverId === m.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40 hover:shadow-md",
                )}>
                <Avatar member={m} hovered={hoveredId === m.id} size="card" />
                <div className="p-3">
                  {safeText(m.tagline) && <p className="mb-2 text-xs text-muted-foreground line-clamp-2">{safeText(m.tagline)}</p>}
                  <div className="flex flex-wrap gap-1">
                    {(m.attributes ?? []).slice(0, 3).map((a) => (
                      <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
                    ))}
                    {(m.attributes ?? []).length > 3 && <span className="text-[11px] text-muted-foreground">+{(m.attributes ?? []).length - 3}</span>}
                  </div>
                  {m.email && <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{m.email}</span></div>}
                </div>
              </div>
            ))}
          </div>
          {inactive.length > 0 && <InactiveRow members={inactive} onEdit={openEdit} dragProps={dragProps} draggingId={draggingId} dragOverId={dragOverId} />}
        </>
      )}

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {view === "list" && (
        <>
          <div className="space-y-2">
            {active.map((m) => (
              <div key={m.id} {...dragProps(m)}
                onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(null)}
                onClick={() => openEdit(m)}
                className={cn(
                  "flex cursor-grab items-center gap-4 rounded-xl border bg-card p-4 transition active:cursor-grabbing",
                  draggingId === m.id ? "opacity-40" : "opacity-100",
                  dragOverId === m.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40 hover:shadow-sm",
                )}>
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                <Avatar member={m} hovered={hoveredId === m.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{m.name}</span>
                    {m.role && <span className="text-sm text-muted-foreground">{m.role}</span>}
                    {m.department && <span className="text-xs text-muted-foreground">· {m.department}</span>}
                  </div>
                  {safeText(m.tagline) && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{safeText(m.tagline)}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(m.attributes ?? []).slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">
                  {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                  {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                </div>
              </div>
            ))}
          </div>
          {inactive.length > 0 && <InactiveRow members={inactive} onEdit={openEdit} dragProps={dragProps} draggingId={draggingId} dragOverId={dragOverId} />}
        </>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {view === "table" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border text-left">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Member</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Role</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">Department</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Attributes</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">Contact</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id} {...dragProps(m)}
                  onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(null)}
                  onClick={() => openEdit(m)}
                  className={cn(
                    "cursor-grab transition active:cursor-grabbing",
                    draggingId === m.id ? "opacity-40 bg-muted/20" : "",
                    dragOverId === m.id ? "bg-accent/5 outline outline-1 outline-accent" : "hover:bg-muted/30",
                  )}>
                  <td className="px-2 py-3 text-center text-muted-foreground/40"><GripVertical className="h-4 w-4 mx-auto" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar member={m} hovered={hoveredId === m.id} size="xs" />
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{m.role ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{m.department || "—"}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(m.attributes ?? []).slice(0, 2).map((a) => (
                        <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
                      ))}
                      {(m.attributes ?? []).length > 2 && <span className="text-[11px] text-muted-foreground">+{(m.attributes ?? []).length - 2}</span>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                      {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={m.status === "active" ? "success" : "warning"}>{m.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Kanban ────────────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanCols.map(({ dept, members: colMembers }) => (
            <div
              key={dept}
              className="flex w-64 shrink-0 flex-col gap-3"
              onDragOver={(e) => onDragOverCol(e, dept)}
              onDrop={(e) => onDropCol(e, dept)}
            >
              {/* Column header */}
              <div className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 transition",
                dragOverCol === dept ? "border-accent bg-accent/5" : "border-border bg-card",
              )}>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{dept}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{colMembers.length}</span>
              </div>

              {/* Column cards */}
              <div className="flex flex-col gap-2">
                {colMembers.map((m) => (
                  <div key={m.id} {...dragProps(m, dept)}
                    onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(null)}
                    onClick={() => openEdit(m)}
                    className={cn(
                      "cursor-grab overflow-hidden rounded-xl border bg-card transition active:cursor-grabbing",
                      draggingId === m.id ? "opacity-40 scale-95" : "opacity-100",
                      dragOverId === m.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40 hover:shadow-sm",
                    )}>
                    <Avatar member={m} hovered={hoveredId === m.id} size="kanban" />
                    <div className="p-3">
                      {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                      {safeText(m.tagline) && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{safeText(m.tagline)}</p>}
                      {m.email && <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{m.email}</span></div>}
                    </div>
                  </div>
                ))}

                {/* Empty column drop zone */}
                {colMembers.length === 0 && (
                  <div className={cn(
                    "flex h-20 items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground transition",
                    dragOverCol === dept ? "border-accent bg-accent/5 text-accent" : "border-border",
                  )}>
                    Drop here
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Add new column button */}
          <button
            type="button"
            className="flex h-10 w-64 shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
            onClick={() => {
              const dept = prompt("Column name (department):");
              if (!dept?.trim()) return;
              setMembers((prev) => prev); // triggers kanbanCols recalc — user must edit a member to assign
              openAdd();
              setDraft((d) => ({ ...d, department: dept.trim() }));
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Column
          </button>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">{modal.member ? "Edit Team Member" : "Add Team Member"}</h2>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={closeModal}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-5">
              {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Full Name" required><input className={iCls} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></F>
                <F label="Job Title"><input className={iCls} value={draft.role ?? ""} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} /></F>
                <F label="Department"><input className={iCls} value={draft.department ?? ""} onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))} /></F>
                <F label="Email"><input type="email" className={iCls} value={draft.email ?? ""} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></F>
                <F label="Phone"><input type="tel" className={iCls} value={draft.phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></F>
                <F label="Status">
                  <select className={iCls} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as "active" | "inactive" }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </F>
              </div>
              <F label="Tagline"><input className={iCls} placeholder="Brief tagline shown on cards…" value={draft.tagline ?? ""} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} /></F>
              <F label="Bio"><textarea className={cn(iCls, "min-h-[80px] resize-none")} value={draft.bio ?? ""} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} /></F>
              <F label="Availability"><input className={iCls} placeholder="e.g. Mon–Fri, 8am–5pm" value={draft.availability ?? ""} onChange={(e) => setDraft((d) => ({ ...d, availability: e.target.value }))} /></F>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Profile Photo URL"><input className={iCls} placeholder="https://…" value={draft.profile_photo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, profile_photo: e.target.value }))} /></F>
                <F label="Secondary / Hover Photo URL"><input className={iCls} placeholder="https://…" value={draft.secondary_photo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, secondary_photo: e.target.value }))} /></F>
              </div>
              {(draft.profile_photo || draft.secondary_photo) && (
                <div className="flex gap-3">
                  {draft.profile_photo && <img src={draft.profile_photo} alt="Profile" className="h-20 w-20 rounded-lg object-cover object-top" />}
                  {draft.secondary_photo && <img src={draft.secondary_photo} alt="Secondary" className="h-20 w-20 rounded-lg object-cover object-top opacity-80" />}
                </div>
              )}
              <F label="Key Attributes">
                <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
                  {(draft.attributes ?? []).map((a) => (
                    <span key={a} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                      {a}<button type="button" onClick={() => setDraft((d) => ({ ...d, attributes: (d.attributes ?? []).filter((x) => x !== a) }))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  <input
                    className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Add attribute…"
                    value={attrInput}
                    onChange={(e) => setAttrInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addAttr(); } }}
                  />
                </div>
              </F>
              <div className="flex items-center justify-between pt-2">
                <div>
                  {modal.member && (
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { closeModal(); setDeleteConfirm(modal.member!.id); }}>Delete member</button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
                  <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : modal.member ? "Save Changes" : "Add Member"}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="font-semibold">Remove Team Member</h2>
            <p className="mt-2 text-sm text-muted-foreground">This will permanently delete the team member record.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => void confirmDelete(deleteConfirm)}>{saving ? "Removing…" : "Remove"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InactiveRow({ members, onEdit, dragProps, draggingId, dragOverId }: {
  members: TeamMember[];
  onEdit: (m: TeamMember) => void;
  dragProps: (m: TeamMember) => object;
  draggingId: string | null;
  dragOverId: string | null;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Inactive</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {members.map((m) => (
          <div key={m.id} {...dragProps(m)}
            className={cn(
              "flex cursor-grab items-center gap-3 rounded-lg border p-3 transition opacity-60 hover:opacity-100 active:cursor-grabbing",
              draggingId === m.id ? "opacity-30" : "",
              dragOverId === m.id ? "border-accent ring-1 ring-accent" : "border-border",
            )}
            onClick={() => onEdit(m)}>
            {m.profile_photo
              ? <img src={m.profile_photo} alt={m.name} className="h-9 w-9 rounded-full object-cover object-top" />
              : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4 text-muted-foreground" /></div>}
            <div><div className="text-sm font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.role}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>{children}</div>;
}
