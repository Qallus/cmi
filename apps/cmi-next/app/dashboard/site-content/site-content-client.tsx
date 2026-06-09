"use client";

import * as React from "react";
import { BookOpen, Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "./page";

const BLOCK_TYPES = ["hero", "notification", "cta", "section", "banner", "custom"];

const TYPE_TONES: Record<string, "accent" | "info" | "warning" | "default"> = {
  hero: "accent",
  notification: "warning",
  cta: "info",
  section: "default",
  banner: "warning",
  custom: "default",
};

const EMPTY_BLOCK: Omit<ContentBlock, "id" | "created_at" | "updated_at"> = {
  key: "",
  type: "hero",
  title: "",
  subtitle: "",
  body: "",
  button_label: "",
  button_url: "",
  image_url: "",
  pages: "*",
  enabled: true,
};

export function SiteContentClient({ initialBlocks }: { initialBlocks: ContentBlock[] }) {
  const [blocks, setBlocks] = React.useState<ContentBlock[]>(initialBlocks);
  const [editingId, setEditingId] = React.useState<string | "new" | null>(null);
  const [draft, setDraft] = React.useState<Omit<ContentBlock, "id" | "created_at" | "updated_at">>(EMPTY_BLOCK);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ContentBlock[]>();
    for (const b of blocks) {
      const list = map.get(b.type) ?? [];
      list.push(b);
      map.set(b.type, list);
    }
    return map;
  }, [blocks]);

  function openNew() {
    setDraft({ ...EMPTY_BLOCK });
    setEditingId("new");
    setError(null);
  }

  function openEdit(b: ContentBlock) {
    setDraft({ key: b.key, type: b.type, title: b.title ?? "", subtitle: b.subtitle ?? "", body: b.body ?? "", button_label: b.button_label ?? "", button_url: b.button_url ?? "", image_url: b.image_url ?? "", pages: b.pages ?? "*", enabled: b.enabled });
    setEditingId(b.id);
    setError(null);
  }

  function closeEdit() { setEditingId(null); setError(null); }

  async function save() {
    if (!draft.key) { setError("Key is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = editingId === "new" ? draft : { id: editingId, ...draft };
      const res = await fetch("/api/site-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json() as ContentBlock & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (editingId === "new") {
        setBlocks((prev) => [...prev, json]);
      } else {
        setBlocks((prev) => prev.map((b) => (b.id === json.id ? json : b)));
      }
      setSaved(json.id);
      setTimeout(() => setSaved(null), 2000);
      closeEdit();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function toggleEnabled(b: ContentBlock) {
    try {
      const res = await fetch("/api/site-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, enabled: !b.enabled }) });
      const json = await res.json() as ContentBlock;
      setBlocks((prev) => prev.map((x) => (x.id === json.id ? json : x)));
    } catch { /* silent */ }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">CMS</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Site Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage content blocks displayed on the public site.</p>
        </div>
        <Button size="sm" variant="accent" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Block</Button>
      </div>

      {blocks.length === 0 && !editingId && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">No content blocks yet.</div>
          <Button size="sm" variant="outline" onClick={openNew}>Create your first block</Button>
        </div>
      )}

      {Array.from(grouped.entries()).map(([type, typeBlocks]) => (
        <div key={type} className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={TYPE_TONES[type] ?? "default"} className="capitalize">{type}</Badge>
            <span className="text-xs text-muted-foreground">{typeBlocks.length} block{typeBlocks.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {typeBlocks.map((b) => (
              <div
                key={b.id}
                className={cn("flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition hover:border-accent/40", !b.enabled && "opacity-50")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{b.key}</code>
                    {b.pages && <span className="text-xs text-muted-foreground">→ {b.pages}</span>}
                  </div>
                  {b.title && <div className="mt-0.5 truncate text-sm font-medium">{b.title}</div>}
                  {b.body && <div className="mt-0.5 truncate text-xs text-muted-foreground">{b.body}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleEnabled(b)}
                    className={cn("relative h-5 w-9 rounded-full transition-colors", b.enabled ? "bg-accent" : "bg-muted")}
                  >
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", b.enabled ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                  {saved === b.id && <Check className="h-3.5 w-3.5 text-success" />}
                  <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit / Add modal */}
      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">{editingId === "new" ? "New Content Block" : "Edit Content Block"}</h2>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={closeEdit}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Key (unique identifier)" required>
                  <input className={iCls} value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="e.g. homepage_hero" />
                </F>
                <F label="Type">
                  <select className={iCls} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
                    {BLOCK_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </F>
              </div>
              <F label="Title"><input className={iCls} value={draft.title ?? ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></F>
              <F label="Subtitle"><input className={iCls} value={draft.subtitle ?? ""} onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} /></F>
              <F label="Body / Message">
                <textarea className={cn(iCls, "min-h-[80px] resize-none")} value={draft.body ?? ""} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
              </F>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Button Label"><input className={iCls} value={draft.button_label ?? ""} onChange={(e) => setDraft((d) => ({ ...d, button_label: e.target.value }))} /></F>
                <F label="Button URL"><input className={iCls} value={draft.button_url ?? ""} onChange={(e) => setDraft((d) => ({ ...d, button_url: e.target.value }))} /></F>
              </div>
              <F label="Image URL"><input className={iCls} placeholder="https://…" value={draft.image_url ?? ""} onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))} /></F>
              <F label="Pages (comma-separated, * for all)"><input className={iCls} placeholder="* or /home, /about" value={draft.pages ?? "*"} onChange={(e) => setDraft((d) => ({ ...d, pages: e.target.value }))} /></F>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enabled" checked={draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked })) } className="h-4 w-4 rounded border-border accent-accent" />
                <label htmlFor="enabled" className="text-sm">Enabled</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={closeEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Block"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</label>{children}</div>;
}
