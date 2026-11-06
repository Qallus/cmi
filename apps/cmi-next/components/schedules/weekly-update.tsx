"use client";

// Weekly schedule update (Phase 2 Step 2): walk the tasks since the last
// status date, type % or click Done, start or push the late ones (a push needs
// a reason, logged to the job), then Finish update moves the status date to
// today and re-forecasts. Bolt drafts the narrative; the PM edits it and copies
// it or posts it to today's daily log. Nothing is sent from here.
import * as React from "react";
import { AlertTriangle, Check, ClipboardCopy, Loader2, NotebookPen, Play, Redo2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { nextWeekday, type UpdateFlag } from "@/lib/schedules/weekly-update";
import { ScheduleModal } from "./schedule-modal";
import { fmtDate } from "./shared";

type Row = {
  flag: UpdateFlag;
  task: { id: string; title: string; kind: string; status: string | null; start_date: string | null; end_date: string | null; percent_complete: number; actual_start: string | null; actual_finish: string | null; assignees: string[] };
};
type Loaded = { schedule: { id: string; name: string; job_id: string | null; status_date: string | null; engine: boolean }; today: string; rows: Row[]; canPostLog: boolean };
type Finish = { from: string | null; to: string; finishBefore: string | null; finishAfter: string | null; moved: { id: string; title: string; from: string | null; to: string | null }[]; critical: string[] };

export function WeeklyUpdate({ scheduleId, open, onClose, onChanged, onBanner }: {
  scheduleId: string; open: boolean; onClose: () => void;
  /** Reload the schedule after a change (dates, %, status date). */
  onChanged: () => Promise<void> | void;
  onBanner: (message: string) => void;
}) {
  const [data, setData] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pushing, setPushing] = React.useState<{ id: string; to: string; reason: string } | null>(null);
  const [finish, setFinish] = React.useState<Finish | null>(null);
  const [text, setText] = React.useState("");
  const [byBolt, setByBolt] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [posted, setPosted] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/schedules/${scheduleId}/update`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Couldn't load the update."); return; }
    setError(null); setData(j);
  }, [scheduleId]);
  // Mounted fresh for each update (the workspace renders it only while open).
  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedules/${scheduleId}/update`).then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!live) return;
      if (res.ok) setData(j); else setError(j.error ?? "Couldn't load the update.");
    }).catch(() => { if (live) setError("Couldn't load the update."); });
    return () => { live = false; };
  }, [scheduleId]);

  async function run(key: string, fn: () => Promise<Response>) {
    setBusy(key); setError(null);
    try {
      const res = await fn();
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "That didn't save.");
      await load();
      void onChanged();
      return j;
    } catch (e) { setError((e as Error).message); return null; } finally { setBusy(null); }
  }
  const patchItem = (id: string, patch: Record<string, unknown>) =>
    run(id, () => fetch(`/api/schedule-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }));
  const post = (body: Record<string, unknown>) =>
    fetch(`/api/schedules/${scheduleId}/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function savePush() {
    if (!pushing) return;
    const ok = await run(pushing.id, () => post({ action: "push", itemId: pushing.id, to: pushing.to, reason: pushing.reason }));
    if (ok) setPushing(null);
  }

  async function draft(result: Finish) {
    setDrafting(true);
    try {
      const res = await post({ action: "narrative", result });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't draft the narrative.");
      setText(j.text ?? ""); setByBolt(!!j.byBolt);
    } catch (e) { setError((e as Error).message); } finally { setDrafting(false); }
  }

  async function finishUpdate() {
    const j = (await run("finish", () => post({ action: "finish" }))) as Finish | null;
    if (!j) return;
    setFinish(j);
    onBanner(`Update finished. Status date ${fmtDate(j.to)}; forecast finish ${fmtDate(j.finishAfter)}.`);
    void draft(j);
  }

  async function postToLog() {
    setBusy("post"); setError(null);
    try {
      const res = await post({ action: "post_log", text });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't post it.");
      setPosted(`Posted to today's daily log${j.logNumber ? ` (#${j.logNumber})` : ""}, under Internal notes.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const rows = data?.rows ?? [];
  const late = rows.filter((r) => r.flag === "not_started").length;
  const period = data ? `${data.schedule.status_date ? fmtDate(data.schedule.status_date) : "Start"} → ${fmtDate(data.today)}` : "";
  const shift = finish?.finishBefore && finish.finishAfter && finish.finishBefore !== finish.finishAfter
    ? Math.round((Date.parse(finish.finishAfter) - Date.parse(finish.finishBefore)) / 86400000) : 0;

  return (
    <ScheduleModal open={open} side title={finish ? "Update finished" : `Weekly update · ${period}`} onClose={onClose}
      footer={finish ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => finish && void draft(finish)} disabled={drafting}><Redo2 className="h-3.5 w-3.5" /> Redraft</Button>
          <Button size="sm" variant="outline" disabled={!text} onClick={() => { void navigator.clipboard?.writeText(text); onBanner("Narrative copied."); }}><ClipboardCopy className="h-3.5 w-3.5" /> Copy</Button>
          {data?.canPostLog ? <Button size="sm" variant="outline" disabled={!text || busy === "post" || !!posted} onClick={postToLog}><NotebookPen className="h-3.5 w-3.5" /> Post to daily log</Button> : null}
          <Button size="sm" variant="accent" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Moves the status date to {data ? fmtDate(data.today) : "today"} and re-forecasts.</span>
          <Button size="sm" variant="accent" onClick={finishUpdate} disabled={!data || busy === "finish"}>
            {busy === "finish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Finish update
          </Button>
        </div>
      )}>
      <div className="space-y-3 pb-4 text-sm">
        {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
        {!data && !error ? <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : null}

        {data && !finish ? (
          <>
            <p className="text-xs text-muted-foreground">
              Tasks since the last status date. Type % or click Done.{late ? <> <span className="font-medium text-amber-700 dark:text-amber-400">{late} should have started</span>: start them, or push with a reason.</> : null}
            </p>
            {!rows.length ? <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-muted-foreground">Nothing was due this period.</div> : null}
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map(({ task: t, flag }) => {
                const done = t.status === "complete" || t.percent_complete >= 100;
                return (
                  <li key={t.id} className={cn("space-y-2 px-3 py-2", flag === "not_started" && "bg-amber-500/5")}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-medium", done && "text-muted-foreground line-through")}>{t.kind === "milestone" ? "◆ " : ""}{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {fmtDate(t.start_date)}{t.kind !== "milestone" ? ` – ${fmtDate(t.end_date)}` : ""}{t.assignees.length ? ` · ${t.assignees.join(", ")}` : ""}
                          {flag === "not_started" ? <span className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> Should have started</span> : null}
                          {flag === "finish_due" ? <span className="ml-1.5 font-medium text-destructive">Finish was due</span> : null}
                        </div>
                      </div>
                      {busy === t.id ? <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                      {!done ? (
                        <>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input type="number" min={0} max={100} defaultValue={t.percent_complete} key={`${t.id}-${t.percent_complete}`} aria-label={`% complete for ${t.title}`}
                              onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== t.percent_complete) void patchItem(t.id, { percent_complete: v }); }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="h-7 w-14 rounded border border-border bg-background px-1.5 text-right text-xs text-foreground tabular-nums" />%
                          </label>
                          <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy === t.id} onClick={() => void patchItem(t.id, { percent_complete: 100 })}><Check className="h-3.5 w-3.5" /> Done</Button>
                        </>
                      ) : <span className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Done {fmtDate(t.actual_finish)}</span>}
                    </div>
                    {flag === "not_started" && pushing?.id !== t.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy === t.id} onClick={() => void patchItem(t.id, { actual_start: data.today })}><Play className="h-3.5 w-3.5" /> Started today</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPushing({ id: t.id, to: nextWeekday(data.today), reason: "" })}>Push…</Button>
                      </div>
                    ) : null}
                    {pushing?.id === t.id ? (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">New start</span>
                          <DateField value={pushing.to} onChange={(d) => setPushing((p) => (p ? { ...p, to: d || p.to } : p))} className="h-8" triggerProps={{ "aria-label": "New start date" }} />
                        </div>
                        <input autoFocus value={pushing.reason} onChange={(e) => setPushing((p) => (p ? { ...p, reason: e.target.value } : p))}
                          onKeyDown={(e) => { if (e.key === "Enter" && pushing.reason.trim()) void savePush(); }}
                          placeholder="Why? e.g. Waiting on the window delivery" maxLength={300}
                          className="h-8 w-full rounded border border-border bg-background px-2 text-xs" />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setPushing(null)}>Cancel</Button>
                          <Button size="sm" variant="accent" className="h-7" disabled={!pushing.reason.trim() || busy === t.id} onClick={savePush}>Push</Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {finish ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Forecast finish</div>
                <div className="font-medium">{fmtDate(finish.finishBefore)} → {fmtDate(finish.finishAfter)}</div>
                <div className={cn("text-[11px]", shift > 0 ? "text-destructive" : shift < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                  {shift ? `${shift > 0 ? "+" : ""}${shift} days` : "No change"}
                </div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status date</div>
                <div className="font-medium">{fmtDate(finish.to)}</div>
                <div className="text-[11px] text-muted-foreground">{finish.moved.length} task{finish.moved.length === 1 ? "" : "s"} moved</div>
              </div>
            </div>
            {finish.moved.length ? (
              <details className="rounded-md border border-border px-3 py-2 text-xs">
                <summary className="cursor-pointer font-medium">What moved</summary>
                <ul className="mt-1.5 space-y-0.5">{finish.moved.slice(0, 40).map((m) => <li key={m.id}>{m.title}: {fmtDate(m.from)} → {fmtDate(m.to)}</li>)}</ul>
              </details>
            ) : null}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Narrative</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  {drafting ? <><Loader2 className="h-3 w-3 animate-spin" /> Bolt is drafting…</> : text ? (byBolt ? <><Sparkles className="h-3 w-3" /> Drafted by Bolt; edit before sharing</> : "Plain draft (Bolt wasn't available)") : null}
                </span>
              </div>
              <textarea value={text} onChange={(e) => { setText(e.target.value); setPosted(null); }} rows={16} disabled={drafting}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed" />
              {posted ? <div className="text-xs text-emerald-700 dark:text-emerald-400">{posted}</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </ScheduleModal>
  );
}
