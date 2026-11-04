"use client";

// Work-calendar editor (Spec R2 §5): the company calendar (Settings →
// Scheduling) or one job's / schedule's overrides. Working weekdays, dated
// exceptions with a type, running counts by type, and "Add CMI holidays for
// a year". Saving recalculates the critical-path schedules that use it.
import * as React from "react";
import { Plus, Trash2, Loader2, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { cmiHolidays, dayNum, dayOfWeek, EXCEPTION_LABELS, type CalendarException, type CalendarLevel, type ExceptionType } from "@/lib/schedules/calendar";
import type { Workdays } from "@/lib/schedules/types";

const DAYS: [keyof Workdays, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const MON_FRI: Workdays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function CalendarEditor({ scope, scopeId, intro, onSaved }: {
  scope: "company" | "job" | "schedule";
  scopeId?: string | null;
  intro?: React.ReactNode;
  onSaved?: (msg: string) => void;
}) {
  const qs = `scope=${scope}${scope === "company" ? "" : `&id=${scopeId}`}`;
  const [loaded, setLoaded] = React.useState(false);
  const [canEdit, setCanEdit] = React.useState(false);
  const [inherited, setInherited] = React.useState<CalendarLevel | null>(null);
  const [inherit, setInherit] = React.useState(scope !== "company");
  const [workdays, setWorkdays] = React.useState<Workdays>(MON_FRI);
  const [rows, setRows] = React.useState<CalendarException[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [year, setYear] = React.useState(new Date().getFullYear() + 1);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedule-calendars?${qs}`).then((r) => r.json()).then((d) => {
      if (!live) return;
      setCanEdit(!!d.canEdit);
      setInherited(d.inherited ?? null);
      const own = d.calendar as { workdays: Workdays | null; exceptions: CalendarException[] } | null;
      setInherit(scope !== "company" && !own?.workdays);
      setWorkdays(own?.workdays ?? (d.inherited?.workdays as Workdays | null) ?? MON_FRI);
      setRows(own?.exceptions ?? []);
      setLoaded(true);
    }).catch(() => { if (live) { setMsg({ ok: false, text: "Couldn't load the calendar." }); setLoaded(true); } });
    return () => { live = false; };
  }, [qs, scope]);

  const closed = rows.filter((r) => !r.working);
  const counts = (Object.keys(EXCEPTION_LABELS) as ExceptionType[]).map((t) => [t, closed.filter((r) => r.type === t).length] as const).filter(([, n]) => n);
  const set = (i: number, patch: Partial<CalendarException>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function addRow(row?: Partial<CalendarException>) {
    const date = row?.date ?? new Date().toISOString().slice(0, 10);
    setRows((rs) => [...rs, { date, working: false, type: scope === "company" ? "holiday" : "weather", label: "", ...row }]);
  }
  function addHolidays() {
    const existing = new Set(rows.map((r) => r.date));
    const add = cmiHolidays(year).filter((h) => ![0, 6].includes(dayOfWeek(dayNum(h.date))) && !existing.has(h.date));
    setRows((rs) => [...rs, ...add].sort((a, b) => a.date.localeCompare(b.date)));
    setMsg({ ok: true, text: add.length ? `Added ${add.length} holiday${add.length === 1 ? "" : "s"} for ${year}. Save to keep them.` : `${year}'s holidays are already on the list.` });
  }
  /** On a job: work a company holiday (e.g. a crew works the Friday after Thanksgiving). */
  function workHoliday(h: CalendarException) {
    if (rows.some((r) => r.date === h.date)) return;
    setRows((rs) => [...rs, { date: h.date, working: true, type: "other" as ExceptionType, label: `Working ${h.label ?? "the holiday"}` }].sort((a, b) => a.date.localeCompare(b.date)));
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/schedule-calendars?${qs}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workdays: scope !== "company" && inherit ? null : workdays, exceptions: rows }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return; }
      const text = d.recalculated ? `Saved. ${d.recalculated} schedule${d.recalculated === 1 ? "" : "s"} recalculated, ${d.moved} task${d.moved === 1 ? "" : "s"} moved.` : "Saved.";
      setMsg({ ok: true, text });
      onSaved?.(text);
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…</div>;
  const ro = !canEdit;
  const companyHolidays = (inherited?.exceptions ?? []).filter((e) => !e.working && e.date >= new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-5">
      {intro ? <div className="text-sm text-muted-foreground">{intro}</div> : null}

      <section className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Working days</div>
        {scope !== "company" ? (
          <div role="radiogroup" aria-label="Working days" className="flex flex-wrap gap-2 text-sm">
            {([[true, "Same as the company calendar"], [false, "Set for this " + (scope === "job" ? "job" : "schedule")]] as const).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={inherit === v} disabled={ro} onClick={() => setInherit(v)}
                className={cn("rounded-md border px-3 py-1.5 transition disabled:opacity-60", inherit === v ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>{l}</button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5" aria-label="Days of the week">
          {DAYS.map(([k, l]) => {
            const on = workdays[k];
            const locked = ro || (scope !== "company" && inherit);
            return (
              <button key={k} type="button" aria-pressed={on} disabled={locked} onClick={() => setWorkdays((w) => ({ ...w, [k]: !w[k] }))}
                className={cn("h-8 w-12 rounded-md border text-xs font-medium transition disabled:cursor-not-allowed", on ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted", locked && "opacity-60")}>{l}</button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{scope === "company" ? "Holidays and closed days" : "Days this job is closed (or open)"}</div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {counts.length ? counts.map(([t, n]) => <span key={t} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 tabular-nums text-muted-foreground">{n} {EXCEPTION_LABELS[t].toLowerCase()} day{n === 1 ? "" : "s"}</span>) : <span className="text-muted-foreground">None yet</span>}
          </div>
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(150px,1fr)_110px_130px_minmax(140px,2fr)_32px] items-center gap-1.5">
              <DateField value={r.date} onChange={(v) => v && set(i, { date: v })} allowClear={false} className="h-8" triggerProps={{ "aria-label": "Date", disabled: ro }} />
              <Select value={r.working ? "open" : "closed"} onChange={(e) => set(i, { working: e.target.value === "open" })} disabled={ro} className="[&>button]:h-8" aria-label="Open or closed">
                <option value="closed">Closed</option><option value="open">Working</option>
              </Select>
              <Select value={r.type} onChange={(e) => set(i, { type: e.target.value as ExceptionType })} disabled={ro} className="[&>button]:h-8" aria-label="Type">
                {(Object.keys(EXCEPTION_LABELS) as ExceptionType[]).map((t) => <option key={t} value={t}>{EXCEPTION_LABELS[t]}</option>)}
              </Select>
              <Input value={r.label ?? ""} onChange={(e) => set(i, { label: e.target.value })} disabled={ro} placeholder={r.type === "weather" ? "e.g. Monsoon" : r.type === "owner" ? "e.g. HOA quiet day" : "Label"} className="h-8" aria-label="Label" />
              <button type="button" disabled={ro} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${fmt(r.date)}`} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!rows.length ? <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{scope === "company" ? "No holidays yet." : "No job-specific days. Company holidays still apply."}</div> : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => addRow()}><Plus className="h-3.5 w-3.5" /> Add a day</Button>
            {scope === "company" ? (
              <span className="flex items-center gap-1.5">
                <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-24 [&>button]:h-8" aria-label="Year">
                  {[0, 1, 2].map((n) => { const y = new Date().getFullYear() + n; return <option key={y} value={y}>{y}</option>; })}
                </Select>
                <Button size="sm" variant="outline" onClick={addHolidays}><CalendarPlus className="h-3.5 w-3.5" /> Add CMI holidays</Button>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {scope !== "company" && companyHolidays.length ? (
        <section className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Company holidays (apply unless worked)</div>
          <div className="flex flex-wrap gap-1.5">
            {companyHolidays.slice(0, 16).map((h) => {
              const worked = rows.some((r) => r.date === h.date && r.working);
              return (
                <button key={h.date} type="button" disabled={ro || worked} onClick={() => workHoliday(h)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs transition", worked ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted")}>
                  {fmt(h.date)} · {h.label}{worked ? " · working" : canEdit ? " · work it" : ""}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {msg ? <div className={cn("rounded-md border px-3 py-2 text-sm", msg.ok ? "border-accent/30 bg-accent/5 text-foreground" : "border-destructive/40 bg-destructive/10 text-destructive")}>{msg.text}</div> : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="accent" size="sm" onClick={() => void save()} disabled={saving}>{saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save calendar"}</Button>
        </div>
      ) : <div className="text-xs text-muted-foreground">{scope === "company" ? "Admins maintain the company calendar." : "Admins and Project Managers change a job's calendar."}</div>}
    </div>
  );
}
