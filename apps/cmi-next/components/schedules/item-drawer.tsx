"use client";

import * as React from "react";
import { COLOR_SWATCHES } from "./item-colors-panel";
import { Trash2, Link2, X, Plus } from "lucide-react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RecordPicker } from "./record-picker";
import {
  ITEM_STATUS_LABELS, PRIORITY_LABELS, DEPENDENCY_LABELS, DEPENDENCY_ABBR, MILESTONE_TYPE_LABELS,
  type MilestoneType, type ScheduleItem, type SchedulePhase, type ScheduleDependency, type ItemStatus,
  type SchedulePriority, type MasterDisplay, type DependencyType, type Assignee,
} from "@/lib/schedules/types";

type Staff = { id: string; name: string };

export function ItemDrawer({
  open, item, phases, staff, allItems, dependencies, isMasterSchedule, canEdit, linkable = false, engine = false,
  onClose, onSave, onDelete, onAddDependency, onRemoveDependency,
}: {
  open: boolean;
  item: Partial<ScheduleItem> | null;
  phases: SchedulePhase[];
  staff: Staff[];
  allItems: ScheduleItem[];
  dependencies: ScheduleDependency[];
  isMasterSchedule?: boolean;
  canEdit?: boolean;
  /** Schedule Builder: the item can point at a dashboard record. */
  linkable?: boolean;
  /** Schedule engine on: activity ID, duration, constraint, actuals, float. */
  engine?: boolean;
  onClose: () => void;
  onSave: (patch: Partial<ScheduleItem>) => void | Promise<void>;
  onDelete?: () => void;
  onAddDependency?: (sourceItemId: string, type: DependencyType, lag: number) => void;
  onRemoveDependency?: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState<Partial<ScheduleItem>>({});
  const [saving, setSaving] = React.useState(false);
  const [depSource, setDepSource] = React.useState("");
  const [depType, setDepType] = React.useState<DependencyType>("finish_to_start");
  React.useEffect(() => { if (open) setDraft(item ?? {}); }, [open, item]);
  if (!open) return null;
  const isNew = !item?.id;
  const kind = draft.kind ?? "task";
  const set = <K extends keyof ScheduleItem>(k: K, v: ScheduleItem[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const selectedAssignees = (draft.assignees ?? []) as Assignee[];
  const toggleAssignee = (s: Staff) => {
    const has = selectedAssignees.some((a) => a.id === s.id);
    set("assignees", has ? selectedAssignees.filter((a) => a.id !== s.id) : [...selectedAssignees, { id: s.id, name: s.name, type: "staff" }]);
  };

  async function save() {
    if (!draft.title?.trim()) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  // Predecessors of this item (deps where target = item), and what follows it.
  const predecessors = item?.id ? dependencies.filter((d) => d.target_item_id === item.id) : [];
  const successors = item?.id ? dependencies.filter((d) => d.source_item_id === item.id) : [];
  const itemName = (id: string) => allItems.find((i) => i.id === id)?.title ?? "Item";

  return (
    <ScheduleModal
      open={open}
      onClose={onClose}
      side={engine}
      title={isNew ? `New ${kind === "milestone" ? "Milestone" : "Item"}` : draft.title || "Item"}
      footer={canEdit ? (
        <div className="flex items-center gap-2">
          {!isNew && onDelete ? <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button> : null}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={() => void save()} disabled={saving || !draft.title?.trim()}>{saving ? "Saving…" : isNew ? "Create" : "Save"}</Button>
        </div>
      ) : undefined}
    >
      <div className="space-y-4 pb-2">
        <div className="flex gap-2">
          {(["task", "milestone"] as const).map((k) => (
            <button key={k} type="button" disabled={!canEdit} onClick={() => set("kind", k)} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition", kind === k ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted")}>{k === "milestone" ? "◆ Milestone" : "Task"}</button>
          ))}
        </div>

        <Field label="Title" required>
          <Input value={draft.title ?? ""} disabled={!canEdit} onChange={(e) => set("title", e.target.value)} placeholder={kind === "milestone" ? "e.g. Permit Issued" : "e.g. Frame walls"} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><Select value={draft.status ?? "not_started"} disabled={!canEdit} onChange={(e) => set("status", e.target.value as ItemStatus)}>{Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Priority"><Select value={draft.priority ?? "normal"} disabled={!canEdit} onChange={(e) => set("priority", e.target.value as SchedulePriority)}>{Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>

        {phases.length ? (
          <Field label="Phase"><Select value={draft.phase_id ?? ""} disabled={!canEdit} onChange={(e) => set("phase_id", e.target.value || null)}><option value="">— No phase —</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><Input type="date" value={draft.start_date ?? ""} disabled={!canEdit} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
          <Field label={kind === "milestone" ? "Date" : "Finish"}><Input type="date" value={kind === "milestone" ? (draft.start_date ?? "") : (draft.end_date ?? "")} disabled={!canEdit || kind === "milestone"} onChange={(e) => set("end_date", e.target.value || null)} /></Field>
        </div>

        {engine ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduling</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Activity ID"><Input type="number" value={draft.activity_id ?? ""} disabled={!canEdit} onChange={(e) => set("activity_id", e.target.value ? Number(e.target.value) : null)} /></Field>
              {kind === "task" ? (
                <>
                  <Field label="Duration"><Input type="number" min={1} value={draft.duration_days ?? ""} disabled={!canEdit} onChange={(e) => set("duration_days", e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null)} /></Field>
                  <Field label="Counts"><Select value={draft.duration_unit ?? "workdays"} disabled={!canEdit} onChange={(e) => set("duration_unit", e.target.value as "workdays" | "calendar")}><option value="workdays">Working days</option><option value="calendar">Calendar days</option></Select></Field>
                </>
              ) : (
                <Field label="Milestone type"><Select value={draft.milestone_type ?? ""} disabled={!canEdit} onChange={(e) => set("milestone_type", (e.target.value || null) as MilestoneType | null)}><option value="">—</option>{Object.entries(MILESTONE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Constraint"><Select value={draft.constraint_type ?? ""} disabled={!canEdit || !!draft.is_locked} onChange={(e) => { const v = (e.target.value || null) as ScheduleItem["constraint_type"]; setDraft((d) => ({ ...d, constraint_type: v, constraint_date: v ? d.constraint_date ?? d.start_date ?? null : null })); }}>
                <option value="">None</option><option value="snet">Start No Earlier Than</option><option value="mfo">Must Finish On</option><option value="alap">As Late As Possible</option>
              </Select></Field>
              <Field label="Constraint date"><Input type="date" value={draft.constraint_date ?? ""} disabled={!canEdit || !draft.constraint_type || draft.constraint_type === "alap"} onChange={(e) => set("constraint_date", e.target.value || null)} /></Field>
              <Field label="Actual start"><Input type="date" value={draft.actual_start ?? ""} disabled={!canEdit} onChange={(e) => set("actual_start", e.target.value || null)} /></Field>
              <Field label="Actual finish"><Input type="date" value={draft.actual_finish ?? ""} disabled={!canEdit} onChange={(e) => set("actual_finish", e.target.value || null)} /></Field>
              {kind !== "milestone" ? <Field label="Remaining (working days)"><Input type="number" min={0} value={draft.remaining_duration ?? ""} disabled={!canEdit} placeholder="From % complete" onChange={(e) => set("remaining_duration", e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))))} /></Field> : null}
              {kind === "milestone" ? <Field label="Contract date"><Input type="date" value={draft.contract_date ?? ""} disabled={!canEdit} onChange={(e) => set("contract_date", e.target.value || null)} /></Field> : null}
              <Field label="Cost code"><Input value={draft.cost_code ?? ""} disabled={!canEdit} onChange={(e) => set("cost_code", e.target.value || null)} placeholder="Budget line" /></Field>
            </div>
            {item?.early_start ? (
              <div className="grid grid-cols-3 gap-x-3 gap-y-1 rounded bg-muted/40 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">Early</span><span className="col-span-2 tabular-nums">{item.early_start} → {item.early_finish}</span>
                <span className="text-muted-foreground">Late</span><span className="col-span-2 tabular-nums">{item.late_start} → {item.late_finish}</span>
                <span className="text-muted-foreground">Float</span><span className="col-span-2 tabular-nums">{item.total_float} total · {item.free_float} free (working days){item.total_float != null && item.total_float <= 0 ? <strong className="ml-1">critical</strong> : null}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === "task" ? (
          <Field label={`Progress — ${draft.percent_complete ?? 0}%`}>
            <input type="range" min={0} max={100} step={5} value={draft.percent_complete ?? 0} disabled={!canEdit} onChange={(e) => set("percent_complete", Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>
        ) : null}

        <Field label="Assignees">
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => { const on = selectedAssignees.some((a) => a.id === s.id); return (
              <button key={s.id} type="button" disabled={!canEdit} onClick={() => toggleAssignee(s)} className={cn("rounded-full border px-2.5 py-1 text-xs transition", on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted")}>{s.name}</button>
            ); })}
            {!staff.length ? <span className="text-xs text-muted-foreground">No staff available.</span> : null}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsible company"><Input value={draft.responsible_company ?? ""} disabled={!canEdit} onChange={(e) => set("responsible_company", e.target.value || null)} placeholder="Vendor / trade" /></Field>
          <Field label="Location"><Input value={draft.location ?? ""} disabled={!canEdit} onChange={(e) => set("location", e.target.value || null)} placeholder="Area / room" /></Field>
        </div>

        {linkable ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Linked to</span>
            <RecordPicker
              disabled={!canEdit}
              value={draft.link_type && draft.link_id ? { type: draft.link_type, id: draft.link_id, label: draft.link_label ?? "Record" } : null}
              onChange={(v) => setDraft((d) => ({
                ...d, link_type: v?.type ?? null, link_id: v?.id ?? null, link_label: v?.label ?? null,
                // A new item takes the record's name as its title until you type one.
                title: !d.title?.trim() && v ? v.label : d.title,
              }))}
              placeholder="A deal, job, vendor, trade partner, selection, schedule…"
            />
          </div>
        ) : null}

        <Field label="Tags"><Input value={(draft.tags ?? []).join(", ")} disabled={!canEdit} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="comma, separated" /></Field>

        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Client visible" checked={!!draft.client_visible} disabled={!canEdit} onChange={(v) => set("client_visible", v)} />
          <Toggle label="Confirmation required" checked={!!draft.confirmation_required} disabled={!canEdit} onChange={(v) => set("confirmation_required", v)} />
          <Toggle label="Critical" checked={!!draft.is_critical} disabled={!canEdit} onChange={(v) => set("is_critical", v)} />
          <Toggle label="Lock dates" checked={!!draft.is_locked} disabled={!canEdit} onChange={(v) => set("is_locked", v)} />
        </div>

        {isMasterSchedule ? (
          <Field label="Show on Master"><Select value={draft.master_display ?? "inherit"} disabled={!canEdit} onChange={(e) => set("master_display", e.target.value as MasterDisplay)}>
            <option value="inherit">Inherit</option><option value="always_show">Always show</option><option value="show_when_critical">Show when critical</option><option value="milestone_only">Milestone only</option><option value="do_not_show">Do not show</option>
          </Select></Field>
        ) : null}

        <Field label="Internal notes"><Textarea rows={2} value={draft.internal_notes ?? ""} disabled={!canEdit} onChange={(e) => set("internal_notes", e.target.value || null)} placeholder="Staff only — never shown to clients" /></Field>
        <Field label="Client notes"><Textarea rows={2} value={draft.client_notes ?? ""} disabled={!canEdit} onChange={(e) => set("client_notes", e.target.value || null)} placeholder="Shown in the client portal when visible" /></Field>

        {/* Dependencies */}
        {!isNew ? (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Predecessors</div>
            <div className="space-y-1.5">
              {predecessors.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
                  <span className="truncate">{itemName(d.source_item_id)} <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">{DEPENDENCY_ABBR[d.dependency_type]}{d.lag_days ? ` ${d.lag_days > 0 ? "+" : ""}${d.lag_days}d` : ""}</span>{d.is_cross_schedule ? <span className="ml-1 text-[10px] text-accent">cross</span> : null}</span>
                  {canEdit ? <button type="button" onClick={() => onRemoveDependency?.(d.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button> : null}
                </div>
              ))}
              {!predecessors.length ? <p className="text-xs text-muted-foreground">No predecessors.</p> : null}
            </div>
            {engine && successors.length ? (
              <div className="mt-2 text-xs text-muted-foreground">Followed by: {successors.map((d) => `${itemName(d.target_item_id)} (${DEPENDENCY_ABBR[d.dependency_type]}${d.lag_days ? `${d.lag_days > 0 ? "+" : ""}${d.lag_days}` : ""})`).join(", ")}</div>
            ) : null}
            {canEdit && onAddDependency ? (
              <div className="mt-2 flex items-center gap-1.5">
                <Select value={depSource} onChange={(e) => setDepSource(e.target.value)} className="flex-1 text-xs"><option value="">Add predecessor…</option>{allItems.filter((i) => i.id !== item?.id).map((i) => <option key={i.id} value={i.id}>{i.schedule_name ? `${i.schedule_name}: ` : ""}{i.title}</option>)}</Select>
                <Select value={depType} onChange={(e) => setDepType(e.target.value as DependencyType)} className="w-28 text-xs">{Object.entries(DEPENDENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{DEPENDENCY_ABBR[v as DependencyType]}</option>)}</Select>
                <Button size="sm" variant="outline" disabled={!depSource} onClick={() => { if (depSource) { onAddDependency(depSource, depType, 0); setDepSource(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {engine && !isNew && item?.id ? <TaskHistory itemId={item.id} /> : null}
      </div>
    </ScheduleModal>
  );
}

const HISTORY_LABEL: Record<string, string> = {
  title: "Name", start_date: "Start", end_date: "Finish", duration_days: "Duration", duration_unit: "Counts", status: "Status",
  percent_complete: "% complete", kind: "Kind", constraint_type: "Constraint", constraint_date: "Constraint date", is_locked: "Locked",
  actual_start: "Actual start", actual_finish: "Actual finish", milestone_type: "Milestone type", contract_date: "Contract date",
  cost_code: "Cost code", phase_id: "Phase", activity_id: "Activity ID", remaining_duration: "Remaining", bar_color: "Bar color",
};
// Colours read as their swatch name ("Green"), custom ones as the hex.
const SWATCH_NAME = new Map(COLOR_SWATCHES.map(([hex, name]) => [hex.toLowerCase(), name]));
const shown = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no")
  : typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? SWATCH_NAME.get(v.toLowerCase()) ?? v : String(v));

/** Every change to this task: who, when, what (before → after), and moves the schedule made. */
function TaskHistory({ itemId }: { itemId: string }) {
  const [rows, setRows] = React.useState<{ id: string; at: string; who: string; via: string | null; action: string; changes: Record<string, [unknown, unknown]> }[] | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedule-items/${itemId}/history`).then((r) => r.json()).then((d) => { if (live) setRows(d.history ?? []); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [itemId]);
  const items = (rows ?? []).filter((r) => Object.keys(r.changes).length);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</div>
      {rows === null ? <p className="text-xs text-muted-foreground">Loading…</p> : !items.length ? <p className="text-xs text-muted-foreground">No changes recorded yet.</p> : (
        <ol className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {items.map((r) => (
            <li key={r.id} className="text-xs">
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span><span className="font-medium text-foreground">{r.who}</span>{r.via ? ` · ${r.via}` : ""}</span>
                <span className="shrink-0 tabular-nums">{new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {Object.entries(r.changes).map(([k, [a, b]]) => (
                <div key={k}><span className="text-muted-foreground">{HISTORY_LABEL[k] ?? k}:</span> {shown(a)} → <span className="font-medium">{shown(b)}</span></div>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}</label>{children}</div>;
}
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm", disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}
