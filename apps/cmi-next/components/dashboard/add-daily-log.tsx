"use client";

// Add a daily log from anywhere: pick one or more Jobs / Pre-Con opportunities,
// fill in what happened, save. The same log is filed against each one picked,
// so a superintendent who walked several sites records it once.
//
// Full-screen on phones (this is used on site), a centred dialog on desktop.
import * as React from "react";
import { Check, HardHat, Loader2, NotebookPen, Search, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Target = { kind: "job" | "opportunity"; id: string; label: string; sub: string };

const todayAz = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

export function AddDailyLogDialog({ onClose, onSaved, preselect }: {
  onClose: () => void;
  onSaved: (count: number) => void;
  preselect?: { kind: "job" | "opportunity"; id: string } | null;
}) {
  const [targets, setTargets] = React.useState<Target[] | null>(null);
  const [picked, setPicked] = React.useState<Target[]>([]);
  const [q, setQ] = React.useState("");
  const [f, setF] = React.useState({
    log_date: todayAz(), title: "", notes: "", weather: "", temperature: "", hours_worked: "",
    crew: "", visitors: "", delays: "", client_visible: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch("/api/daily-logs/targets").then((r) => (r.ok ? r.json() : [])).then((list: Target[]) => {
      if (!live) return;
      setTargets(list);
      const pre = preselect && list.find((t) => t.kind === preselect.kind && t.id === preselect.id);
      if (pre) setPicked([pre]);
    }).catch(() => { if (live) setTargets([]); });
    return () => { live = false; };
  }, [preselect]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const key = (t: { kind: string; id: string }) => `${t.kind}:${t.id}`;
  const isPicked = (t: Target) => picked.some((p) => key(p) === key(t));
  const toggle = (t: Target) => setPicked((p) => (isPicked(t) ? p.filter((x) => key(x) !== key(t)) : [...p, t]));

  const needle = q.trim().toLowerCase();
  const matches = (targets ?? []).filter((t) => !needle || `${t.label} ${t.sub}`.toLowerCase().includes(needle)).slice(0, 40);
  const anyJob = picked.some((p) => p.kind === "job");

  async function save() {
    if (!picked.length) { setError("Choose at least one Job or Pre-Con."); return; }
    if (!f.notes.trim() && !f.title.trim()) { setError("Add a title or some notes."); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/daily-logs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targets: picked.map(({ kind, id }) => ({ kind, id })),
        log_date: f.log_date,
        title: f.title.trim() || null,
        notes: f.notes.trim() || null,
        weather: f.weather.trim() || null,
        temperature: f.temperature.trim() || null,
        hours_worked: f.hours_worked === "" ? null : Number(f.hours_worked),
        crew: f.crew.split(",").map((s) => s.trim()).filter(Boolean),
        visitors: f.visitors.trim() || null,
        delays: f.delays.trim() || null,
        client_visible: f.client_visible,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError((json as { error?: string }).error ?? "Couldn't save the log."); return; }
    onSaved(picked.length);
  }

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
  const label = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Add daily log"
        className="flex h-full w-full flex-col bg-card shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><NotebookPen className="h-4 w-4 text-accent" /> Add daily log</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {/* Where it goes */}
          <div>
            <span className={label}>Log for: one or more Jobs or Pre-Con</span>
            {picked.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span key={key(p)} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-2.5 pr-1 text-xs font-medium text-accent">
                    {p.kind === "job" ? <HardHat className="h-3 w-3" /> : <Workflow className="h-3 w-3" />}
                    {p.label}
                    <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.label}`} className="rounded-full p-0.5 hover:bg-accent/20"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or job number" className={cn(input, "pl-8")} />
            </div>
            <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {targets === null && <li className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading jobs and Pre-Con…</li>}
              {targets !== null && matches.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Nothing matches.</li>}
              {matches.map((t) => (
                <li key={key(t)}>
                  <button type="button" onClick={() => toggle(t)}
                    className={cn("flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted", isPicked(t) && "bg-accent/10")}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t.sub}</span>
                    </span>
                    {isPicked(t) && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>Date</span><input type="date" value={f.log_date} onChange={(e) => setF({ ...f, log_date: e.target.value })} className={input} /></label>
            <label><span className={label}>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Framing inspection passed" className={input} /></label>
          </div>
          <label className="block"><span className={label}>What happened today</span>
            <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={5} placeholder="Work completed, deliveries, decisions, anything the team should know" className={cn(input, "resize-y")} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className={label}>Weather</span><input value={f.weather} onChange={(e) => setF({ ...f, weather: e.target.value })} placeholder="Sunny" className={input} /></label>
            <label><span className={label}>Temperature</span><input value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} placeholder="92°F" className={input} /></label>
            <label><span className={label}>Hours worked</span><input type="number" inputMode="decimal" min="0" step="0.5" value={f.hours_worked} onChange={(e) => setF({ ...f, hours_worked: e.target.value })} className={input} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>Crew on site (comma separated)</span><input value={f.crew} onChange={(e) => setF({ ...f, crew: e.target.value })} placeholder="Framing crew, Electrician" className={input} /></label>
            <label><span className={label}>Visitors</span><input value={f.visitors} onChange={(e) => setF({ ...f, visitors: e.target.value })} placeholder="Inspector, client" className={input} /></label>
          </div>
          <label className="block"><span className={label}>Delays or issues</span>
            <input value={f.delays} onChange={(e) => setF({ ...f, delays: e.target.value })} placeholder="Leave blank if none" className={input} />
          </label>
          {anyJob && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.client_visible} onChange={(e) => setF({ ...f, client_visible: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
              Show on the client portal (Jobs only)
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {picked.length > 1 ? `Save to ${picked.length}` : "Save log"}
          </Button>
        </div>
      </div>
    </div>
  );
}
