"use client";

// Phase 2 Step 6: how many working days before a task starts its staff
// assignees get a "Starting soon" reminder on this job (0 = off).
import * as React from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReminderSetting({ jobId, canManage, onSaved }: { jobId: string; canManage: boolean; onSaved: (msg: string) => void }) {
  const [days, setDays] = React.useState<number | null>(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch(`/api/jobs/${jobId}/schedule-settings`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (live && d?.available) { setDays(d.reminder_days); setValue(String(d.reminder_days)); }
    }).catch(() => {});
    return () => { live = false; };
  }, [jobId]);
  if (days === null) return null;

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/schedule-settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminder_days: Number(value) }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't save.");
      setDays(d.reminder_days);
      onSaved(d.reminder_days ? `Assignees are reminded ${d.reminder_days} working day${d.reminder_days === 1 ? "" : "s"} before a task starts.` : "Start reminders are off for this job.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mb-4 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Bell className="h-4 w-4 text-accent" />
        <span>Remind assigned staff</span>
        <input type="number" min={0} max={30} value={value} disabled={!canManage} onChange={(e) => setValue(e.target.value)} aria-label="Working days before a task starts"
          className="h-8 w-16 rounded border border-border bg-background px-2 text-right tabular-nums" />
        <span>working days before a task starts</span>
        {canManage && String(days) !== value ? <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save</Button> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">0 turns it off. Reminders show in the bell, and on phones with notifications on. A task that moves gets a new reminder for its new date.</p>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
