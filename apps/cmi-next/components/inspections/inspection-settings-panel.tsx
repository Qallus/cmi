"use client";

import * as React from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cutoffToTimeInput, formatCutoff } from "@/lib/inspections/settings";
import type { InspectionJurisdiction } from "@/lib/inspections/data";

// Settings → Scheduling → Inspections. The jurisdiction list (how each takes
// inspection requests and its next-day cutoff) and who may update inspection
// status. Claude can change the same things through the CMI MCP.

type Settings = { status_editor_roles: string[]; always: string[]; options: { value: string; label: string }[]; can_edit: boolean };

export function InspectionSettingsPanel() {
  const [list, setList] = React.useState<InspectionJurisdiction[] | null>(null);
  const [canEdit, setCanEdit] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null); // code, or "new"

  const fetchList = React.useCallback(() => fetch("/api/inspections/jurisdictions?all=1")
    .then(async (res) => ({ ok: res.ok, j: await res.json().catch(() => ({})) as { jurisdictions?: InspectionJurisdiction[]; can_edit?: boolean; error?: string } })), []);
  const apply = React.useCallback(({ ok, j }: Awaited<ReturnType<typeof fetchList>>) => {
    if (!ok) { setLoadError(j.error ?? "Couldn't load the jurisdictions."); return; }
    setList(j.jurisdictions ?? []);
    setCanEdit(!!j.can_edit);
  }, []);
  const load = React.useCallback(async () => apply(await fetchList()), [apply, fetchList]);
  React.useEffect(() => {
    let live = true;
    fetchList().then((r) => { if (live) apply(r); }).catch(() => { if (live) setLoadError("Couldn't load the jurisdictions."); });
    return () => { live = false; };
  }, [fetchList, apply]);

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!list) return <p className="text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Loading…</p>;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Jurisdictions</h3>
          {canEdit && editing !== "new" ? (
            <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Plus className="h-3.5 w-3.5" /> Add jurisdiction</button>
          ) : null}
        </div>
        {list.length === 0 && editing !== "new" ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">The inspection library hasn&apos;t been loaded yet (migration 2026-11-11_inspection_milestones and its seed).</p>
        ) : null}
        <div className="divide-y divide-border rounded-md border border-border">
          {editing === "new" ? <JurisdictionForm onDone={async () => { setEditing(null); await load(); }} onCancel={() => setEditing(null)} /> : null}
          {list.map((j) => editing === j.code ? (
            <JurisdictionForm key={j.code} jurisdiction={j} onDone={async () => { setEditing(null); await load(); }} onCancel={() => setEditing(null)} />
          ) : (
            <div key={j.code} className={cn("flex items-start justify-between gap-3 px-3 py-2.5", j.active === false && "opacity-60")}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {j.name}
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{j.code}</span>
                  {j.active === false ? <span className="text-[11px] text-muted-foreground">Retired</span> : null}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className={cn("font-medium", j.cutoff_minutes == null ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
                    {j.cutoff_minutes == null ? "Cutoff to confirm" : `Request by ${formatCutoff(j.cutoff_minutes)}`}
                  </span>
                  {j.cutoff_label ? <> · {j.cutoff_label}</> : null}
                  {j.verified_on ? <> · verified {j.verified_on}</> : null}
                </div>
              </div>
              {canEdit ? <button type="button" onClick={() => setEditing(j.code)} aria-label={`Edit ${j.name}`} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button> : null}
            </div>
          ))}
        </div>
        {!canEdit ? <p className="mt-2 text-xs text-muted-foreground">Super Admins and Admins edit this list.</p> : null}
      </section>
      <StatusRoles />
    </div>
  );
}

function JurisdictionForm({ jurisdiction: j, onDone, onCancel }: { jurisdiction?: InspectionJurisdiction; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const isNew = !j;
  const [f, setF] = React.useState(() => ({
    code: j?.code ?? "",
    name: j?.name ?? "",
    cutoffMode: j?.cutoff_minutes == null ? "none" : j.cutoff_minutes >= 1440 ? "midnight" : "time",
    cutoffTime: cutoffToTimeInput(j?.cutoff_minutes),
    cutoff_label: j?.cutoff_label ?? "",
    scheduling_method: j?.scheduling_method ?? "",
    portal_url: j?.portal_url ?? "",
    phone: j?.phone ?? "",
    inspection_hours: j?.inspection_hours ?? "",
    notes: j?.notes ?? "",
    verified_on: j?.verified_on ?? "",
    active: j?.active !== false,
  }));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (f.cutoffMode === "time" && !f.cutoffTime) { setError("Pick a cutoff time, or choose Midnight / Not published."); return; }
    setBusy(true); setError(null);
    const cutoff_time = f.cutoffMode === "none" ? "" : f.cutoffMode === "midnight" ? "midnight" : f.cutoffTime;
    const body = {
      ...(isNew ? { code: f.code.trim().toUpperCase() } : {}),
      name: f.name, cutoff_time, scheduling_method: f.scheduling_method, portal_url: f.portal_url, phone: f.phone,
      inspection_hours: f.inspection_hours, notes: f.notes, verified_on: f.verified_on, active: f.active,
      // An empty label is filled in from the time ("3:30 PM the business day before").
      ...(f.cutoff_label.trim() ? { cutoff_label: f.cutoff_label } : {}),
    };
    try {
      const res = await fetch(isNew ? "/api/inspections/jurisdictions" : `/api/inspections/jurisdictions/${j!.code}`, {
        method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "Couldn't save.");
      await onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); setBusy(false); }
  }

  const label = "block text-xs font-medium text-muted-foreground";
  return (
    <form className="space-y-3 bg-muted/20 p-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className={label}>Code
          {isNew
            ? <Input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="GIL" className="mt-1 font-mono" maxLength={6} />
            : <div className="mt-1 h-9 rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground">{j!.code}</div>}
        </label>
        <label className={label}>Name<Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Town of Gilbert" className="mt-1" /></label>
      </div>
      <fieldset>
        <legend className={label}>Next-day cutoff (request by, the business day before)</legend>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {(["time", "midnight", "none"] as const).map((m) => (
            <button key={m} type="button" onClick={() => set("cutoffMode", m)}
              className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition", f.cutoffMode === m ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>
              {m === "time" ? "Time" : m === "midnight" ? "Midnight" : "Not published"}
            </button>
          ))}
          {f.cutoffMode === "time" ? <Input type="time" value={f.cutoffTime} onChange={(e) => set("cutoffTime", e.target.value)} className="w-32" aria-label="Cutoff time" /> : null}
        </div>
      </fieldset>
      <label className={label}>Cutoff note<Input value={f.cutoff_label} onChange={(e) => set("cutoff_label", e.target.value)} placeholder="Leave blank to fill in from the time, e.g. 9:00 PM (IVR), Mon–Fri" className="mt-1" /></label>
      <label className={label}>How to request<Textarea value={f.scheduling_method} onChange={(e) => set("scheduling_method", e.target.value)} rows={2} className="mt-1" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>Phone<Input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1" /></label>
        <label className={label}>Portal URL<Input value={f.portal_url} onChange={(e) => set("portal_url", e.target.value)} placeholder="https://…" className="mt-1" /></label>
        <label className={label}>Inspection hours<Input value={f.inspection_hours} onChange={(e) => set("inspection_hours", e.target.value)} className="mt-1" /></label>
      </div>
      <label className={label}>Notes<Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="mt-1" /></label>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className={label}>Last verified<Input type="date" value={f.verified_on} onChange={(e) => set("verified_on", e.target.value)} className="mt-1 w-40" /></label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Offered on jobs</label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-muted"><X className="h-4 w-4" /> Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

// Who may update an inspection's status. Super Admin changes it; everyone sees it.
function StatusRoles() {
  const [s, setS] = React.useState<Settings | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(() => { fetch("/api/inspections/settings").then((r) => r.json()).then((j) => { if (j.options) setS(j); }).catch(() => {}); }, []);
  if (!s) return null;

  async function toggle(role: string) {
    if (!s) return;
    const next = s.status_editor_roles.includes(role) ? s.status_editor_roles.filter((r) => r !== role) : [...s.status_editor_roles, role];
    const prev = s;
    setS({ ...s, status_editor_roles: next }); setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/inspections/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status_editor_roles: next }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't save.");
      setS({ ...prev, status_editor_roles: j.status_editor_roles ?? next }); setMsg("Saved");
    } catch (e) { setS(prev); setMsg(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold">Who can update inspection status</h3>
      <p className="mb-2 text-xs text-muted-foreground">Passed, Failed / Correction, Re-inspect and the rest. Super Admins and Admins always can.{s.can_edit ? "" : " Super Admins change this."}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {s.options.map((o) => (
          <label key={o.value} className={cn("flex items-center gap-2 text-sm", !s.can_edit && "opacity-70")}>
            <input type="checkbox" checked={s.status_editor_roles.includes(o.value)} disabled={!s.can_edit || busy} onChange={() => void toggle(o.value)} /> {o.label}
          </label>
        ))}
      </div>
      {msg ? <p className="mt-1.5 text-xs text-muted-foreground">{msg}</p> : null}
    </section>
  );
}
