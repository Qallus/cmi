"use client";

// Settings → Dashboard: the company default Overview (Super Admin) and the
// What's New entries (admins). Bolt and Claude can draft entries; publishing
// happens here.
import * as React from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { NEWS_ICON_NAMES } from "@/lib/dashboard/news-icons";
import type { WhatsNewRow } from "@/lib/dashboard/whats-new";
import { cn } from "@/lib/utils";

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const btn = "inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50";

export function DashboardSettingsPanel({ flagOn, canSetDefault }: { flagOn: boolean; canSetDefault: boolean }) {
  const [entries, setEntries] = React.useState<WhatsNewRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Partial<WhatsNewRow> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [presetMsg, setPresetMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/dashboard/whats-new");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Couldn't load What's New."); return; }
    setEntries(j.entries ?? []);
  }, []);
  React.useEffect(() => { if (flagOn) void load(); }, [flagOn, load]);

  if (!flagOn) {
    return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Turn on <strong>dashboard_v2</strong> in the Features tab to use the customizable Overview.</p>;
  }

  async function save(publish?: boolean) {
    if (!editing) return;
    setBusy(true); setError(null);
    const body = { ...editing, ...(publish !== undefined ? { published: publish, publish } : {}) };
    const res = await fetch("/api/dashboard/whats-new", { method: editing.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "Couldn't save."); return; }
    setEditing(null);
    await load();
  }

  async function toggle(e: WhatsNewRow) {
    await fetch("/api/dashboard/whats-new", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, published: !e.published_at }) });
    await load();
  }

  async function remove(e: WhatsNewRow) {
    if (!window.confirm(`Delete "${e.title}"?`)) return;
    await fetch(`/api/dashboard/whats-new?id=${e.id}`, { method: "DELETE" });
    await load();
  }

  async function setPreset(preset: string) {
    setPresetMsg(null);
    const res = await fetch("/api/dashboard/defaults", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset }) });
    setPresetMsg(res.ok ? "Saved. People who haven't set up their dashboard will get this." : "Couldn't save.");
  }

  return (
    <div className="space-y-8">
      {canSetDefault && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Company default</h2>
          <p className="text-sm text-muted-foreground">What someone sees on the Overview before they set up their own. To use your own layout as the default, open the Overview, then ⋯ → Make this the company default.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => setPreset("chooser")}>Let each person choose</button>
            <button type="button" className={btn} onClick={() => setPreset("standard")}>Standard</button>
            <button type="button" className={btn} onClick={() => setPreset("blank")}>Blank</button>
          </div>
          {presetMsg ? <p className="text-sm text-muted-foreground">{presetMsg}</p> : null}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">What&apos;s New</h2>
            <p className="text-sm text-muted-foreground">Cards in the Overview&apos;s What&apos;s New row. Bolt or Claude can draft one; publish it here.</p>
          </div>
          <button type="button" className={btn} onClick={() => setEditing({ title: "", body: "", href: "", icon: "Sparkles", tag: "" })}><Plus className="size-4" /> New entry</button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {editing && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <input className={input} placeholder="Title" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <textarea className={cn(input, "min-h-20")} placeholder="One or two sentences" value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={input} placeholder="Link, e.g. /dashboard/events" value={editing.href ?? ""} onChange={(e) => setEditing({ ...editing, href: e.target.value })} />
              <select className={input} value={editing.icon ?? "Sparkles"} onChange={(e) => setEditing({ ...editing, icon: e.target.value })}>
                {NEWS_ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className={input} placeholder="Tag, e.g. New" value={editing.tag ?? ""} onChange={(e) => setEditing({ ...editing, tag: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn(btn, "border-transparent bg-accent text-accent-foreground hover:opacity-90")} disabled={busy || !editing.title?.trim()} onClick={() => save(true)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save and publish
              </button>
              <button type="button" className={btn} disabled={busy || !editing.title?.trim()} onClick={() => save(editing.id ? undefined : false)}>Save draft</button>
              <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}

        {entries === null ? <p className="text-sm text-muted-foreground">Loading…</p> : !entries.length ? (
          <p className="text-sm text-muted-foreground">No entries yet. The Overview shows a few built-in highlights until you add some.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">{e.title}
                    <span className={cn("rounded px-1.5 text-[11px] font-normal", e.published_at ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{e.published_at ? "Live" : "Draft"}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{e.body}</span>
                </span>
                <button type="button" title={e.published_at ? "Unpublish" : "Publish"} onClick={() => toggle(e)} className="rounded p-1 hover:bg-muted">{e.published_at ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                <button type="button" title="Edit" onClick={() => setEditing(e)} className="rounded p-1 hover:bg-muted"><Pencil className="size-4" /></button>
                <button type="button" title="Delete" onClick={() => remove(e)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
