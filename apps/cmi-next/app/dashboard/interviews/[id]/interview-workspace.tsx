"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, CircleDot, Clock, Info,
  Loader2, Plus, Save, ShieldCheck, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput, PhoneInput } from "@/components/ui/formatted-input";
import { isVisible, progressOf, type Answers, type Field, type Section } from "@/lib/prequal/form";
import type { Followup, InterviewEvent, InterviewRow } from "@/lib/interviews/data";
import type { Company } from "@/lib/companies/data";

type StaffOption = { id: string; name: string };

const filled = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The live interview.
 *
 * Three columns, because that is what the meeting needs: the sections you are
 * working through, the questions themselves, and who you are talking to. The
 * questions render from the same engine as the public prequalification form —
 * this screen holds no copy of the questionnaire, only the answers.
 */
export function InterviewWorkspace({
  initial, company, initialEvents, initialFollowups, staff, prefilled,
}: {
  initial: InterviewRow;
  company: Company | null;
  initialEvents: InterviewEvent[];
  initialFollowups: Followup[];
  staff: StaffOption[];
  prefilled: string[];
}) {
  const router = useRouter();
  const [interview, setInterview] = React.useState(initial);
  const [answers, setAnswers] = React.useState<Answers>(initial.answers ?? {});
  const [step, setStep] = React.useState(0);
  const [saved, setSaved] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [followups, setFollowups] = React.useState(initialFollowups);
  const [events, setEvents] = React.useState(initialEvents);
  const [completing, setCompleting] = React.useState(false);

  const sections = interview.sections ?? [];
  const section = sections[step];
  const prefilledSet = React.useMemo(() => new Set(prefilled), [prefilled]);
  const progress = progressOf(answers, sections);
  const done = !!interview.completed_at;

  // Autosave. A meeting is no place to remember to press save.
  const dirty = React.useRef(false);
  React.useEffect(() => {
    if (!dirty.current || done) return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const res = await fetch(`/api/interviews/${interview.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      setSaved(res.ok ? "saved" : "error");
      dirty.current = false;
    }, 800);
    return () => clearTimeout(t);
  }, [answers, interview.id, done]);

  const set = React.useCallback((key: string, value: unknown) => {
    dirty.current = true;
    setSaved("idle");
    setAnswers((a) => ({ ...a, [key]: value }));
  }, []);

  async function refreshDetail() {
    const res = await fetch(`/api/interviews/${interview.id}`);
    if (!res.ok) return;
    const json = await res.json();
    setInterview(json.interview);
    setFollowups(json.followups ?? []);
    setEvents(json.events ?? []);
  }

  const visible = section ? section.fields.filter((f) => isVisible(f, answers)) : [];

  return (
    <div className="p-4 md:p-6">
      {/* Meeting header — who, how far in, and the controls. */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Back to the Interviews tab, which remembers it was the one open. */}
          <Link href="/dashboard/trade-partners" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Interviews
          </Link>
          <h1 className="mt-1.5 truncate font-display text-2xl font-semibold tracking-tight">{interview.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {interview.company_name && <span>{interview.company_name}</span>}
            {interview.interviewer_name && <span>· {interview.interviewer_name}</span>}
            {interview.scheduled_at && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {stamp(interview.scheduled_at)}</span>}
            <span>· {progress}% answered</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveState state={saved} done={done} />
          {done ? (
            <Button
              variant="outline"
              onClick={async () => {
                await fetch(`/api/interviews/${interview.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reopen: true }),
                });
                await refreshDetail();
                router.refresh();
              }}
            >
              Reopen
            </Button>
          ) : (
            <Button variant="accent" onClick={() => setCompleting(true)}>
              <CheckCircle2 className="h-4 w-4" /> Complete interview
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_320px]">
        {/* Sections */}
        <nav aria-label="Interview sections" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <ol className="space-y-0.5">
            {sections.map((s, i) => {
              const answered = s.fields
                .filter((f) => isVisible(f, answers) && f.type !== "content")
                .filter((f) => filled(answers[f.key]));
              const total = s.fields.filter((f) => isVisible(f, answers) && f.type !== "content").length;
              const complete = total > 0 && answered.length === total;
              return (
                <li key={s.key}>
                  <button
                    type="button" onClick={() => setStep(i)}
                    aria-current={i === step ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                      i === step ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span className={cn(
                      "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                      i === step ? "border-accent bg-accent text-accent-foreground"
                        : complete ? "border-accent text-accent"
                        : "border-border text-muted-foreground",
                    )}>
                      {complete && i !== step ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      {s.title}
                      {total > 0 && (
                        <span className="ml-1 text-[11px] opacity-70">{answered.length}/{total}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Questions */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold">{section?.title}</h2>
            {section?.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{section.description}</p>}

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {visible.map((field) => (
                <QuestionField
                  key={field.key} field={field} value={answers[field.key]}
                  fromProfile={prefilledSet.has(field.key)}
                  disabled={done}
                  onChange={(v) => set(field.key, v)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              <Button
                variant="outline" disabled={step >= sections.length - 1}
                onClick={() => setStep((s) => Math.min(sections.length - 1, s + 1))}
              >
                Next section
              </Button>
            </div>
          </div>

          <Followups
            interviewId={interview.id} rows={followups} staff={staff}
            onChanged={() => void refreshDetail()}
          />
        </div>

        {/* Who you are talking to */}
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:self-start">
          <ContactPanel company={company} interview={interview} />
          <Timeline events={events} />
        </aside>
      </div>

      {completing && (
        <CompleteDialog
          interview={interview} answers={answers}
          onClose={() => setCompleting(false)}
          onDone={async () => { setCompleting(false); await refreshDetail(); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SaveState({ state, done }: { state: "idle" | "saving" | "saved" | "error"; done: boolean }) {
  if (done) return <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</span>;
  if (state === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving</span>;
  if (state === "saved") return <span className="flex items-center gap-1 text-xs text-accent"><Check className="h-3 w-3" /> Saved</span>;
  if (state === "error") return <span className="text-xs text-destructive">Not saved</span>;
  return null;
}

/**
 * One question.
 *
 * `fromProfile` is the point of the whole module: an answer we already hold
 * gets marked, so the interviewer confirms it in two seconds instead of making
 * the partner repeat what they already typed into the application.
 */
function QuestionField({
  field, value, fromProfile, disabled, onChange,
}: {
  field: Field; value: unknown; fromProfile: boolean; disabled: boolean; onChange: (v: unknown) => void;
}) {
  const wide = field.type === "textarea" || field.type === "multiselect" || field.type === "content";

  if (field.type === "content") {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground sm:col-span-2">
        {field.body}
      </p>
    );
  }

  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        {field.label}
        {fromProfile && filled(value) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> on file
          </span>
        )}
      </span>
      {field.help && <span className="mb-1.5 block text-xs text-muted-foreground">{field.help}</span>}

      {field.type === "textarea" ? (
        <Textarea className="min-h-[80px]" disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "yesno" ? (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt} type="button" disabled={disabled} onClick={() => onChange(opt === "Yes")}
              className={cn("rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50",
                (value === true && opt === "Yes") || (value === false && opt === "No")
                  ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-muted")}
            >{opt}</button>
          ))}
        </div>
      ) : field.type === "select" ? (
        <Select disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const list = Array.isArray(value) ? (value as string[]) : [];
            const on = list.includes(o);
            return (
              <button
                key={o} type="button" disabled={disabled}
                onClick={() => onChange(on ? list.filter((v) => v !== o) : [...list, o])}
                className={cn("rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50",
                  on ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-muted")}
              >{on && <Check className="mr-1 inline h-3 w-3" />}{o}</button>
            );
          })}
        </div>
      ) : field.type === "phone" ? (
        <PhoneInput disabled={disabled} value={(value as string) ?? ""} onChange={onChange} />
      ) : field.type === "currency" ? (
        <MoneyInput disabled={disabled} value={(value as string) ?? ""} onChange={onChange} />
      ) : (
        <Input
          disabled={disabled}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ContactPanel({ company, interview }: { company: Company | null; interview: InterviewRow }) {
  if (!company) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Info className="mb-2 h-4 w-4" />
        No company linked yet. Answers still save — link one before completing if you want them
        to land on a profile.
      </div>
    );
  }
  const rows: [string, string | null][] = [
    ["Status", company.qualification_status?.replace(/_/g, " ") ?? null],
    ["Trades", company.trades?.join(", ") ?? null],
    ["Service areas", company.service_areas?.join(", ") ?? null],
    ["Phone", company.phone],
    ["Email", company.email],
    ["Job size", company.min_project_value || company.max_project_value
      ? `$${(company.min_project_value ?? 0).toLocaleString("en-US")} – $${(company.max_project_value ?? 0).toLocaleString("en-US")}`
      : null],
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-display text-base font-semibold">{company.name}</h3>
      <dl className="space-y-2 text-sm">
        {rows.filter(([, v]) => !!v).map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="min-w-0 flex-1">{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/dashboard/trade-partners"
        className="mt-4 inline-block text-xs font-medium text-accent hover:underline"
      >
        Open in Trade Partners &rarr;
      </Link>
      {interview.application_id && (
        <p className="mt-2 text-xs text-muted-foreground">Came from a prequalification application.</p>
      )}
    </div>
  );
}

function Timeline({ events }: { events: InterviewEvent[] }) {
  if (events.length === 0) return null;
  return (
    <details className="rounded-2xl border border-border bg-card p-5" open>
      <summary className="cursor-pointer list-none font-display text-base font-semibold">
        History <ChevronDown className="inline h-4 w-4 text-muted-foreground" />
      </summary>
      <ol className="mt-3 space-y-2.5 text-sm">
        {events.slice(0, 20).map((e) => (
          <li key={e.id} className="flex gap-2.5">
            <CircleDot className="mt-1 h-3 w-3 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="leading-snug">{e.kind.replace(/_/g, " ")}</p>
              {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
              <p className="text-[11px] text-muted-foreground">{stamp(e.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Followups({
  interviewId, rows, staff, onChanged,
}: {
  interviewId: string; rows: Followup[]; staff: StaffOption[]; onChanged: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [due, setDue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    await fetch(`/api/interviews/${interviewId}/followups`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, assigned_to: assignee || null,
        due_at: due ? new Date(`${due}T09:00:00`).toISOString() : null,
      }),
    });
    setTitle(""); setAssignee(""); setDue("");
    setBusy(false);
    onChanged();
  }

  async function toggle(id: string, currentlyDone: boolean) {
    await fetch(`/api/interviews/${interviewId}/followups`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: id, done: !currentlyDone }),
    });
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-display text-base font-semibold">Follow-ups</h3>
      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Nothing yet. These are ordinary tasks — they show up against the person too, not
          only in here.
        </p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start gap-2.5 text-sm">
              <button
                type="button" onClick={() => void toggle(t.id, !!t.completed_at)}
                aria-label={t.completed_at ? "Reopen" : "Mark done"}
                className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition",
                  t.completed_at ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent")}
              >
                {t.completed_at && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("leading-snug", t.completed_at && "text-muted-foreground line-through")}>{t.title}</p>
                {(t.assigned_to || t.due_at) && (
                  <p className="text-[11px] text-muted-foreground">
                    {staff.find((s) => s.id === t.assigned_to)?.name ?? "Unassigned"}
                    {t.due_at && ` · due ${new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Input
          className="min-w-[180px] flex-1" placeholder="Request current COI…"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
        />
        <Select className="w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input className="w-auto" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button variant="outline" disabled={busy || !title.trim()} onClick={() => void add()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function CompleteDialog({
  interview, answers, onClose, onDone,
}: {
  interview: InterviewRow; answers: Answers; onClose: () => void; onDone: () => void;
}) {
  const [apply, setApply] = React.useState(true);
  const [summary, setSummary] = React.useState(interview.ai_summary ?? "");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // What completing would write to the profile, so it is a decision rather
  // than a surprise.
  const willUpdate = React.useMemo(() => {
    const keys: string[] = [];
    for (const s of interview.sections ?? []) {
      for (const f of s.fields) {
        if (f.mapsTo && filled(answers[f.key])) keys.push(f.label);
      }
    }
    return keys;
  }, [interview.sections, answers]);

  async function complete() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/interviews/${interview.id}/complete`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply_to_profile: apply, summary: summary || null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not complete."); setBusy(false); return; }
    setResult(json.applied ?? []);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Complete interview" className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-semibold">Complete interview</h3>
        </div>

        {result ? (
          <div className="space-y-3 p-5">
            <p className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {result.length > 0
                ? `Done — ${result.length} field${result.length === 1 ? "" : "s"} written to the profile.`
                : "Done."}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.length > 0
                ? "This partner is now findable by what they told you — trade, area, job size, pricing."
                : "Nothing mapped to the profile, so the answers stay on the interview."}
            </p>
            <div className="flex justify-end">
              <Button variant="accent" onClick={onDone}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
                <input type="checkbox" className="mt-0.5" checked={apply} onChange={(e) => setApply(e.target.checked)} />
                <span>
                  <span className="font-medium">Write the answers to the company profile</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {interview.company_id
                      ? `${willUpdate.length} answer${willUpdate.length === 1 ? "" : "s"} map to profile fields. This is what makes them searchable later.`
                      : "No company is linked, so nothing will be written."}
                  </span>
                </span>
              </label>

              {apply && willUpdate.length > 0 && (
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Show the {willUpdate.length} fields</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {willUpdate.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                </details>
              )}

              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-3.5 w-3.5 text-accent" /> Summary</span>
                <Textarea
                  className="min-h-[100px]" value={summary} onChange={(e) => setSummary(e.target.value)}
                  placeholder="Capable selective-demo crew, 15 W2, Scottsdale and Phoenix, prices from plans, wants $25–150k work. COI expires next month."
                />
              </label>

              {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" onClick={onClose}>Not yet</Button>
              <Button variant="accent" disabled={busy} onClick={() => void complete()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Complete
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
