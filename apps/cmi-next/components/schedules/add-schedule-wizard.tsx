"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SCHEDULE_TYPE_LABELS, DEFAULT_WORKDAYS, type ScheduleType, type ScheduleDraft, type Workdays, type JobSchedule } from "@/lib/schedules/types";

type Staff = { id: string; name: string };
export type ScheduleSource = { mode: "scratch" | "template" | "copy"; templateId?: string; copyFromId?: string };
type TemplateOpt = { id: string; name: string; type: ScheduleType; description?: string };

const STEPS = ["Basics", "Source", "Work Calendar", "Visibility", "Review"];
const DAYS: { k: keyof Workdays; l: string }[] = [
  { k: "mon", l: "Mon" }, { k: "tue", l: "Tue" }, { k: "wed", l: "Wed" }, { k: "thu", l: "Thu" }, { k: "fri", l: "Fri" }, { k: "sat", l: "Sat" }, { k: "sun", l: "Sun" },
];

export function AddScheduleWizard({ open, staff, templates, existing, onClose, onCreate }: {
  open: boolean; staff: Staff[]; templates: TemplateOpt[]; existing: JobSchedule[];
  onClose: () => void; onCreate: (draft: ScheduleDraft, source: ScheduleSource) => Promise<void>;
}) {
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<ScheduleDraft>({ name: "", type: "construction", workdays: { ...DEFAULT_WORKDAYS }, priority: "normal", visibility: "internal", status: "active" });
  const [source, setSource] = React.useState<ScheduleSource>({ mode: "scratch" });

  React.useEffect(() => { if (open) { setStep(0); setDraft({ name: "", type: "construction", workdays: { ...DEFAULT_WORKDAYS }, priority: "normal", visibility: "internal", status: "active" }); setSource({ mode: "scratch" }); } }, [open]);
  if (!open) return null;
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const canNext = step !== 0 || draft.name.trim().length > 0;

  async function create() {
    setSaving(true);
    try { await onCreate(draft, source); } finally { setSaving(false); }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Schedule">
      {/* Step rail */}
      <div className="mb-4 flex items-center gap-1 text-[11px]">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", i === step ? "bg-accent/15 text-accent" : i < step ? "text-accent" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="space-y-3 pb-4">
        {step === 0 ? (
          <>
            <Field label="Schedule name" required><Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Construction, Procurement, Primary Bath" autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={draft.type} onChange={(e) => set("type", e.target.value as ScheduleType)}>{Object.entries(SCHEDULE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Priority"><Select value={draft.priority} onChange={(e) => set("priority", e.target.value as ScheduleDraft["priority"])}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="critical">Critical</option></Select></Field>
            </div>
            <Field label="Description"><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner"><Select value={draft.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value || null)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Manager"><Select value={draft.manager_id ?? ""} onChange={(e) => set("manager_id", e.target.value || null)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><Input type="date" value={draft.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
              <Field label="Target completion"><Input type="date" value={draft.target_completion ?? ""} onChange={(e) => set("target_completion", e.target.value || null)} /></Field>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={!!draft.is_master} onChange={(e) => set("is_master", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              <span>Designate as the Job&apos;s <strong>Master Schedule</strong></span>
            </label>
          </>
        ) : step === 1 ? (
          <>
            <p className="text-xs text-muted-foreground">How should this schedule start?</p>
            <SourceRow active={source.mode === "scratch"} title="Start from scratch" desc="An empty schedule you build up." onClick={() => setSource({ mode: "scratch" })} />
            <SourceRow active={source.mode === "template"} title="Use a template" desc="Seed phases, items, and milestones from a built-in template." onClick={() => setSource({ mode: "template", templateId: templates[0]?.id })} />
            {source.mode === "template" ? (
              <Select value={source.templateId ?? ""} onChange={(e) => setSource({ mode: "template", templateId: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            ) : null}
            <SourceRow active={source.mode === "copy"} title="Copy an existing schedule" desc="Duplicate another schedule on this job." disabled={!existing.length} onClick={() => setSource({ mode: "copy", copyFromId: existing[0]?.id })} />
            {source.mode === "copy" ? (
              <Select value={source.copyFromId ?? ""} onChange={(e) => setSource({ mode: "copy", copyFromId: e.target.value })}>{existing.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            ) : null}
          </>
        ) : step === 2 ? (
          <>
            <p className="text-xs text-muted-foreground">Which days are working days for this schedule? Cascading skips non-workdays.</p>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => { const on = draft.workdays?.[d.k] !== false; return (
                <button key={d.k} type="button" onClick={() => set("workdays", { ...(draft.workdays ?? DEFAULT_WORKDAYS), [d.k]: !on })} className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition", on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted")}>{d.l}</button>
              ); })}
            </div>
          </>
        ) : step === 3 ? (
          <>
            <p className="text-xs text-muted-foreground">Who can see this schedule? Item-level visibility can be tuned later.</p>
            {[["internal", "Internal only", "CMI staff only."], ["client_visible", "Client visible", "Approved items appear in the client portal."], ["vendor_visible", "Vendor visible", "Assigned vendors see their items."], ["contractor_visible", "Contractor visible", "Assigned trade partners see their items."]].map(([v, t, d]) => (
              <SourceRow key={v} active={draft.visibility === v} title={t} desc={d} onClick={() => set("visibility", v)} />
            ))}
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <Row k="Name" v={draft.name || "—"} />
            <Row k="Type" v={SCHEDULE_TYPE_LABELS[draft.type]} />
            <Row k="Master" v={draft.is_master ? "Yes" : "No"} />
            <Row k="Source" v={source.mode === "template" ? `Template: ${templates.find((t) => t.id === source.templateId)?.name ?? ""}` : source.mode === "copy" ? `Copy: ${existing.find((s) => s.id === source.copyFromId)?.name ?? ""}` : "From scratch"} />
            <Row k="Dates" v={`${draft.start_date || "—"} → ${draft.target_completion || "—"}`} />
            <Row k="Workdays" v={DAYS.filter((d) => draft.workdays?.[d.k] !== false).map((d) => d.l).join(", ")} />
            <Row k="Visibility" v={String(draft.visibility)} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        {step > 0 ? <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>Back</Button> : null}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="accent" size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button variant="accent" size="sm" disabled={saving || !draft.name.trim()} onClick={() => void create()}>{saving ? "Creating…" : "Create Schedule"}</Button>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}</label>{children}</div>;
}
function SourceRow({ active, title, desc, disabled, onClick }: { active: boolean; title: string; desc: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("w-full rounded-lg border px-3 py-2.5 text-left transition", active ? "border-accent bg-accent/10" : "border-border hover:bg-muted", disabled && "cursor-not-allowed opacity-50")}>
      <div className="text-sm font-medium">{title}</div><div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
