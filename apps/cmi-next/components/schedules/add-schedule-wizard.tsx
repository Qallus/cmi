"use client";

import * as React from "react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SCHEDULE_TYPE_LABELS, DEFAULT_WORKDAYS, SCOPE_LABELS, type ScheduleType, type ScheduleDraft, type Workdays, type JobSchedule, type ScheduleScope, type ScheduleScopeType } from "@/lib/schedules/types";
import { RecordPicker, type PickedRecord } from "./record-picker";
import { addWorkdays, fmtISO, parseISO } from "@/lib/schedules/workdays";
import { fmtDate, scheduleTree } from "./shared";

type Staff = { id: string; name: string };
// autoCascade: moving a template task moves the tasks linked after it (default), or the PM moves each date by hand.
export type ScheduleSource = { mode: "scratch" | "template" | "copy"; templateId?: string; copyFromId?: string; autoCascade?: boolean };
type TemplateOpt = { id: string; name: string; type: ScheduleType; description?: string; items?: number; phases?: number; span_days?: number; unit?: "calendar" | "workdays" };

const todayISO = () => fmtISO(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
// Where a template lands when it starts on `start`, in the same units the server uses.
function templateFinish(t: TemplateOpt | undefined, start: string | null | undefined, workdays: Workdays): string | null {
  const s = parseISO(start ?? null);
  if (!t?.span_days || !s) return null;
  if (t.unit === "workdays") return fmtISO(addWorkdays(addWorkdays(s, 0, workdays), t.span_days - 1, workdays));
  s.setUTCDate(s.getUTCDate() + t.span_days - 1);
  return fmtISO(s);
}

// "Start" comes first so templates (New Construction…) are the first thing you see.
const STEPS = ["Start", "Details", "Work Calendar", "Visibility", "Review"];
const freshDraft = (): ScheduleDraft => ({ name: "", type: "construction", workdays: { ...DEFAULT_WORKDAYS }, priority: "normal", visibility: "internal", status: "active", start_date: todayISO() });
const DAYS: { k: keyof Workdays; l: string }[] = [
  { k: "mon", l: "Mon" }, { k: "tue", l: "Tue" }, { k: "wed", l: "Wed" }, { k: "thu", l: "Thu" }, { k: "fri", l: "Fri" }, { k: "sat", l: "Sat" }, { k: "sun", l: "Sun" },
];

// `jobs` (the global Schedules page): the first step also asks which job the schedule is for;
// with `scopes` (Schedule Builder) it can be for a Pipeline deal, Pre-Con record or selection instead.
// `parents`: schedules it can go inside (Schedule Builder); `defaultParentId` preselects one.
export function AddScheduleWizard({ open, staff, templates, existing, jobs, scopes = false, parents, defaultParentId, scopeNoun = "Job", onClose, onCreate }: {
  open: boolean; staff: Staff[]; templates: TemplateOpt[]; existing: JobSchedule[]; jobs?: { id: string; label: string }[];
  scopes?: boolean; parents?: JobSchedule[]; defaultParentId?: string | null; scopeNoun?: string;
  onClose: () => void; onCreate: (draft: ScheduleDraft, source: ScheduleSource, scope?: ScheduleScope) => Promise<void>;
}) {
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<ScheduleDraft>(freshDraft);
  const [source, setSource] = React.useState<ScheduleSource>({ mode: "template", autoCascade: true });
  const [jobId, setJobId] = React.useState("");
  const [forType, setForType] = React.useState<ScheduleScopeType>("job");
  const [forRecord, setForRecord] = React.useState<PickedRecord | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStep(0); setDraft({ ...freshDraft(), parent_schedule_id: defaultParentId ?? null }); setSource({ mode: "template", autoCascade: true });
    setJobId(""); setForType("job"); setForRecord(null);
  }, [open, defaultParentId]);
  if (!open) return null;
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  // On the global page the schedule is for the chosen job or record; elsewhere it's for this page's.
  const chosenScope: ScheduleScope | null = !jobs ? null : forType === "job" ? (jobId ? { type: "job", id: jobId } : null) : forRecord ? { type: forType, id: forRecord.id } : null;
  const jobSchedules = !jobs ? existing : chosenScope ? existing.filter((s) => (chosenScope.type === "job" ? s.job_id === chosenScope.id : s.scope_id === chosenScope.id)) : [];
  const noun = jobs ? (forType === "job" ? "Job" : SCOPE_LABELS[forType]) : scopeNoun;
  // Templates load after the dialog opens; until one is picked, the first is the choice.
  const templateId = source.mode === "template" ? source.templateId ?? templates[0]?.id : undefined;
  const template = templateId ? templates.find((t) => t.id === templateId) : undefined;
  const finish = templateFinish(template, draft.start_date, draft.workdays ?? DEFAULT_WORKDAYS);
  const startReady = (!jobs || !!chosenScope)
    && (source.mode !== "template" || (!!template && !!draft.start_date))
    && (source.mode !== "copy" || !!source.copyFromId);
  const canNext = step === 0 ? startReady : step === 1 ? draft.name.trim().length > 0 : true;
  const resolved: ScheduleSource = source.mode === "template" ? { ...source, templateId } : source;

  function pickTemplate(id: string | undefined) {
    setSource((s) => ({ mode: "template", templateId: id, autoCascade: s.autoCascade ?? true }));
    if (!draft.start_date) set("start_date", todayISO());
  }

  // Leaving Start with a template fills the name and type from it, unless already typed.
  function next() {
    if (step === 0 && template) setDraft((d) => ({ ...d, name: d.name.trim() ? d.name : template.name, type: template.type }));
    setStep((s) => s + 1);
  }

  async function create() {
    setSaving(true);
    try { await onCreate(draft, resolved, chosenScope ?? undefined); } finally { setSaving(false); }
  }

  return (
    <ScheduleModal open={open} onClose={onClose} title="Add Schedule" footer={
      <div className="flex items-center gap-2">
        {step > 0 ? <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>Back</Button> : null}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="accent" size="sm" disabled={!canNext} onClick={next}>Next</Button>
        ) : (
          <Button variant="accent" size="sm" disabled={saving || !draft.name.trim()} onClick={() => void create()}>{saving ? "Creating…" : "Create Schedule"}</Button>
        )}
      </div>
    }>
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
            {jobs && scopes ? (
              <>
                <div className="text-xs font-medium text-muted-foreground">Schedule for</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["job", "deal", "precon", "selection"] as const).map((k) => (
                    <ModeButton key={k} active={forType === k} title={k === "job" ? "Job" : SCOPE_LABELS[k]} desc={k === "job" ? "Most schedules" : k === "deal" ? "In Pipeline" : k === "precon" ? "Pre-construction" : "A finish or fixture"}
                      onClick={() => { setForType(k); setForRecord(null); if (source.mode === "copy") setSource({ mode: "scratch" }); }} />
                  ))}
                </div>
              </>
            ) : null}
            {jobs && forType === "job" ? (
              <Field label="Job" required>
                <Select value={jobId} onChange={(e) => { setJobId(e.target.value); if (source.mode === "copy") setSource({ mode: "scratch" }); }} autoFocus>
                  <option value="">Choose a job…</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                </Select>
              </Field>
            ) : jobs ? (
              <Field label={SCOPE_LABELS[forType]} required>
                <RecordPicker key={forType} types={[forType]} value={forRecord} onChange={(v) => { setForRecord(v); if (source.mode === "copy") setSource({ mode: "scratch" }); }} placeholder={`Search ${SCOPE_LABELS[forType].toLowerCase()}s…`} autoFocus />
              </Field>
            ) : null}
            <div className="text-xs font-medium text-muted-foreground">Start from</div>
            <div className="grid grid-cols-3 gap-1.5">
              <ModeButton active={source.mode === "template"} title="Template" desc="New Construction and more" onClick={() => pickTemplate(templateId)} />
              <ModeButton active={source.mode === "scratch"} title="Blank" desc="Build it item by item" onClick={() => setSource({ mode: "scratch" })} />
              <ModeButton active={source.mode === "copy"} title="Copy" desc={jobs && !chosenScope ? `Choose a ${noun.toLowerCase()} first` : `Another schedule on this ${noun.toLowerCase()}`} disabled={!jobSchedules.length} onClick={() => setSource({ mode: "copy", copyFromId: jobSchedules[0]?.id })} />
            </div>
            {source.mode === "template" ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <Field label="Template">
                  <Select value={templateId ?? ""} onChange={(e) => pickTemplate(e.target.value)}>
                    {!templates.length ? <option value="">Loading templates…</option> : null}
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.items ? ` (${t.items} items)` : ""}</option>)}
                  </Select>
                </Field>
                {template ? (
                  <p className="text-xs text-muted-foreground">
                    {template.description}
                    {template.items ? ` ${template.items} items in ${template.phases ?? 0} phase${template.phases === 1 ? "" : "s"}.` : ""}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date" required><Input type="date" value={draft.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
                  <Field label="Estimated finish"><div className="flex h-9 items-center text-sm font-medium">{finish ? fmtDate(finish) : "—"}</div></Field>
                </div>
                <p className="text-xs text-muted-foreground">Every task is laid out from this date with the template&apos;s spacing{template?.unit === "workdays" ? " in working days (the Work Calendar step sets which days count)" : ""}. You can change any date once the schedule is created, or shift the whole schedule later.</p>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">When a task&apos;s dates change</div>
                  <SourceRow active={source.autoCascade !== false} title="Move the tasks that follow it" desc="Linked tasks shift automatically, keeping the template's order and gaps." onClick={() => setSource((s) => ({ ...s, autoCascade: true }))} />
                  <SourceRow active={source.autoCascade === false} title="I'll adjust dates myself" desc="Only the task you change moves. Links stay on each task for reference." onClick={() => setSource((s) => ({ ...s, autoCascade: false }))} />
                </div>
              </div>
            ) : source.mode === "copy" ? (
              <Field label="Schedule to copy">
                <Select value={source.copyFromId ?? ""} onChange={(e) => setSource({ mode: "copy", copyFromId: e.target.value })}>{jobSchedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground">An empty schedule. Add phases, items and milestones once it&apos;s created.</p>
            )}
          </>
        ) : step === 1 ? (
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
              {source.mode === "template" ? (
                <Field label="Start date"><div className="flex h-9 items-center text-sm">{fmtDate(draft.start_date)} <span className="ml-1 text-xs text-muted-foreground">(set on Start)</span></div></Field>
              ) : (
                <Field label="Start date"><Input type="date" value={draft.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
              )}
              <Field label="Target completion"><Input type="date" value={draft.target_completion ?? ""} onChange={(e) => set("target_completion", e.target.value || null)} placeholder={finish ?? undefined} /></Field>
            </div>
            {parents && parents.length ? (
              <Field label="Inside">
                <Select value={draft.parent_schedule_id ?? ""} onChange={(e) => { set("parent_schedule_id", e.target.value || null); if (e.target.value) set("is_master", false); }}>
                  <option value="">— Top level —</option>
                  {scheduleTree(parents).map(({ schedule: s, depth }) => <option key={s.id} value={s.id}>{"\u00A0\u00A0".repeat(depth)}{depth ? "↳ " : ""}{s.name}</option>)}
                </Select>
              </Field>
            ) : null}
            {!draft.parent_schedule_id ? (
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={!!draft.is_master} onChange={(e) => set("is_master", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                <span>Designate as the {noun}&apos;s <strong>Master Schedule</strong></span>
              </label>
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
            {jobs ? <Row k={noun} v={forType === "job" ? jobs.find((j) => j.id === jobId)?.label ?? "—" : forRecord?.label ?? "—"} /> : null}
            {draft.parent_schedule_id ? <Row k="Inside" v={parents?.find((s) => s.id === draft.parent_schedule_id)?.name ?? "—"} /> : null}
            <Row k="Name" v={draft.name || "—"} />
            <Row k="Type" v={SCHEDULE_TYPE_LABELS[draft.type]} />
            <Row k="Master" v={draft.is_master ? "Yes" : "No"} />
            <Row k="Source" v={source.mode === "template" ? `Template: ${template?.name ?? ""}` : source.mode === "copy" ? `Copy: ${existing.find((s) => s.id === source.copyFromId)?.name ?? ""}` : "From scratch"} />
            <Row k="Dates" v={`${draft.start_date || "—"} → ${draft.target_completion || (finish ? `${finish} (estimated)` : "—")}`} />
            {source.mode === "template" ? <Row k="Date changes" v={source.autoCascade === false ? "Adjust by hand" : "Move following tasks"} /> : null}
            <Row k="Workdays" v={DAYS.filter((d) => draft.workdays?.[d.k] !== false).map((d) => d.l).join(", ")} />
            <Row k="Visibility" v={String(draft.visibility)} />
          </div>
        )}
      </div>
    </ScheduleModal>
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
function ModeButton({ active, title, desc, disabled, onClick }: { active: boolean; title: string; desc: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("rounded-lg border px-3 py-2 text-left transition", active ? "border-accent bg-accent/10" : "border-border hover:bg-muted", disabled && "cursor-not-allowed opacity-50")}>
      <div className={cn("text-sm font-medium", active && "text-accent")}>{title}</div><div className="text-[11px] leading-tight text-muted-foreground">{desc}</div>
    </button>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
