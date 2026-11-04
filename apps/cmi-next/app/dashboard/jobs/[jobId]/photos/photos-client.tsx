"use client";

// Field Reports, Step 3: every photo on the job in one place, whatever it was
// uploaded from. Filter, tag (area, trade, tags, client OK), and pick photos
// for an Executive Summary.
import * as React from "react";
import { CheckSquare, Loader2, Sparkles, Square, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-action";
import { ExecSummaryDialog } from "@/components/exec-summary/exec-summary-button";
import type { JobPhoto } from "@/lib/photos/data";

type Facets = { areas: string[]; trades: string[]; tags: string[] };
const SOURCES: [string, string][] = [["", "Any source"], ["daily_log", "Daily logs"], ["job_file", "Job files"], ["job_update", "Client updates"], ["phone", "Phone"], ["exec_summary", "Executive summaries"], ["upload", "Uploads"]];
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.filter(([k]) => k));

const dayOf = (p: JobPhoto) => new Date(p.taken_at ?? p.created_at).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function PhotosClient({ jobId, jobName, initial, initialFacets, canEdit }: {
  jobId: string; jobName: string; initial: JobPhoto[]; initialFacets: Facets; canEdit: boolean;
}) {
  const [photos, setPhotos] = React.useState(initial);
  const [facets, setFacets] = React.useState(initialFacets);
  const [f, setF] = React.useState({ from: "", to: "", source: "", area: "", trade: "", client_ok: "", tag: "" });
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [view, setView] = React.useState<JobPhoto | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string[] | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async (next = f) => {
    const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    const res = await fetch(`/api/jobs/${jobId}/photos?${q}`);
    if (res.ok) { const d = await res.json(); setPhotos(d.photos); setFacets(d.facets); }
  }, [f, jobId]);
  const setFilter = (k: keyof typeof f, v: string) => { const next = { ...f, [k]: v }; setF(next); setSel(new Set()); void load(next); };

  const groups = React.useMemo(() => {
    const m = new Map<string, JobPhoto[]>();
    for (const p of photos) { const d = dayOf(p); m.set(d, [...(m.get(d) ?? []), p]); }
    return [...m.entries()];
  }, [photos]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(patch: Record<string, unknown>, label: string) {
    if (!sel.size) return;
    setBusy(label); setMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel], patch }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't update the photos.");
      await load(); setMsg(`${d.photos.length} photo${d.photos.length === 1 ? "" : "s"} updated.`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  }

  async function removeSelected() {
    if (!(await confirmAction({ title: `Remove ${sel.size} photo${sel.size === 1 ? "" : "s"} from the library?`, body: "The files stay where they were saved (daily log, job Files). They just stop showing here.", tone: "danger", confirmLabel: "Remove" }))) return;
    setBusy("remove");
    await fetch(`/api/jobs/${jobId}/photos`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel] }) });
    setSel(new Set()); await load(); setBusy(null);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload"); setMsg(null);
    let n = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "Job Photos");
      const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
      if (res.ok) n++;
    }
    await load(); setBusy(null); setMsg(`${n} photo${n === 1 ? "" : "s"} uploaded (also in Files → Job Photos).`);
  }

  async function askText(title: string, label: string, placeholder: string): Promise<string | null> {
    const { promptText } = await import("@/components/ui/confirm-action");
    return promptText({ title, label, placeholder, allowEmpty: true, submitLabel: "Apply" });
  }

  const sel1 = sel.size > 0;
  const select = "h-8 rounded-md border border-border bg-background px-2 text-xs";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateField value={f.from} onChange={(v) => setFilter("from", v)} placeholder="From" className="h-8 w-36" />
        <DateField value={f.to} onChange={(v) => setFilter("to", v)} placeholder="To" className="h-8 w-36" />
        <select aria-label="Source" className={select} value={f.source} onChange={(e) => setFilter("source", e.target.value)}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select aria-label="Area" className={select} value={f.area} onChange={(e) => setFilter("area", e.target.value)}><option value="">Any area</option>{facets.areas.map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="Trade" className={select} value={f.trade} onChange={(e) => setFilter("trade", e.target.value)}><option value="">Any trade</option>{facets.trades.map((a) => <option key={a}>{a}</option>)}</select>
        {facets.tags.length ? <select aria-label="Tag" className={select} value={f.tag} onChange={(e) => setFilter("tag", e.target.value)}><option value="">Any tag</option>{facets.tags.map((a) => <option key={a}>{a}</option>)}</select> : null}
        <select aria-label="Client OK" className={select} value={f.client_ok} onChange={(e) => setFilter("client_ok", e.target.value)}><option value="">Client OK: any</option><option value="true">Client OK</option><option value="false">Internal only</option></select>
        <span className="ml-auto text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
        {canEdit ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>{busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload</Button>
          </>
        ) : null}
      </div>

      {sel1 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-card px-3 py-2 shadow-sm">
          <span className="text-sm font-medium">{sel.size} selected</span>
          <button type="button" onClick={() => setSel(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          <span className="mx-1 h-4 w-px bg-border" />
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={async () => { const v = await askText("Set area", "Area", "Kitchen, Primary bath…"); if (v !== null) await bulk({ area: v }, "area"); }}>Area</Button>
              <Button size="sm" variant="ghost" onClick={async () => { const v = await askText("Set trade", "Trade", "Electrical, Tile…"); if (v !== null) await bulk({ trade: v }, "trade"); }}>Trade</Button>
              <Button size="sm" variant="ghost" onClick={async () => { const v = await askText("Set tags", "Tags (comma separated)", "progress, before"); if (v !== null) await bulk({ tags: v.split(",") }, "tags"); }}>Tags</Button>
              <Button size="sm" variant="ghost" onClick={() => void bulk({ client_ok: true }, "ok")}>Client OK</Button>
              <Button size="sm" variant="ghost" onClick={() => void bulk({ client_ok: false }, "internal")}>Internal only</Button>
              <Button size="sm" variant="ghost" onClick={() => void removeSelected()} className="text-destructive">Remove</Button>
            </>
          ) : null}
          <Button size="sm" variant="accent" className="ml-auto" onClick={() => setSummary([...sel])}><Sparkles className="h-3.5 w-3.5" /> Add to Executive Summary</Button>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
      ) : null}
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}

      {!photos.length ? <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No photos match. Photos from daily logs, the phone camera, job Files and Client Updates all show up here.</div> : null}

      {groups.map(([day, list]) => (
        <section key={day}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{dayLabel(day)}</h3>
            <span className="text-xs text-muted-foreground">{list.length}</span>
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => setSel((s) => { const n = new Set(s); const all = list.every((p) => n.has(p.id)); for (const p of list) { if (all) n.delete(p.id); else n.add(p.id); } return n; })}>
              {list.every((p) => sel.has(p.id)) ? "Unselect day" : "Select day"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {list.map((p) => (
              <figure key={p.id} className={cn("group relative overflow-hidden rounded-md border", sel.has(p.id) ? "border-accent ring-2 ring-accent" : "border-border")}>
                <button type="button" className="block w-full" onClick={() => setView(p)} aria-label="Open photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote job photos */}
                  <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </button>
                <button type="button" onClick={() => toggle(p.id)} aria-label={sel.has(p.id) ? "Unselect" : "Select"} className="absolute left-1.5 top-1.5 rounded bg-black/45 p-0.5 text-white">
                  {sel.has(p.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
                {p.starred ? <Star className="absolute right-1.5 top-1.5 h-4 w-4 fill-amber-400 text-amber-400" /> : null}
                <figcaption className="flex flex-wrap items-center gap-1 px-1.5 py-1 text-[10px] text-muted-foreground">
                  {p.client_ok ? <span className="rounded bg-emerald-500/15 px-1 font-medium text-emerald-700 dark:text-emerald-400">Client OK</span> : null}
                  {[p.area, p.trade].filter(Boolean).map((x) => <span key={x} className="rounded bg-muted px-1">{x}</span>)}
                  <span className="ml-auto truncate">{SOURCE_LABEL[p.source_type] ?? p.source_type}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      {view ? <PhotoView photo={view} canEdit={canEdit} facets={facets} onClose={() => setView(null)} onSave={async (patch) => {
        const res = await fetch(`/api/jobs/${jobId}/photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [view.id], patch }) });
        if (res.ok) { const d = await res.json(); setView(d.photos[0] ?? null); await load(); }
      }} /> : null}

      {summary ? <ExecSummaryDialog target="job" id={jobId} name={jobName} asPanel initialPhotoIds={summary} onClose={() => setSummary(null)} /> : null}
    </div>
  );
}

function PhotoView({ photo, canEdit, facets, onClose, onSave }: { photo: JobPhoto; canEdit: boolean; facets: Facets; onClose: () => void; onSave: (patch: Record<string, unknown>) => Promise<void> }) {
  const [d, setD] = React.useState({ caption: photo.caption ?? "", area: photo.area ?? "", trade: photo.trade ?? "", tags: photo.tags.join(", "), client_ok: photo.client_ok, starred: photo.starred });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const input = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote job photos */}
        <img src={photo.url} alt={photo.caption ?? ""} className="max-h-[70vh] min-w-0 flex-1 bg-black object-contain" />
        <div className="w-full shrink-0 space-y-2 p-4 md:w-72">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{new Date(photo.taken_at ?? photo.created_at).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <label className="block text-xs text-muted-foreground">Caption<input className={input} value={d.caption} disabled={!canEdit} onChange={(e) => setD({ ...d, caption: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">Area<input className={input} list="photo-areas" value={d.area} disabled={!canEdit} onChange={(e) => setD({ ...d, area: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">Trade<input className={input} list="photo-trades" value={d.trade} disabled={!canEdit} onChange={(e) => setD({ ...d, trade: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">Tags<input className={input} value={d.tags} disabled={!canEdit} placeholder="progress, before" onChange={(e) => setD({ ...d, tags: e.target.value })} /></label>
          <datalist id="photo-areas">{facets.areas.map((a) => <option key={a} value={a} />)}</datalist>
          <datalist id="photo-trades">{facets.trades.map((a) => <option key={a} value={a} />)}</datalist>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.client_ok} disabled={!canEdit} onChange={(e) => setD({ ...d, client_ok: e.target.checked })} /> OK for the client to see</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.starred} disabled={!canEdit} onChange={(e) => setD({ ...d, starred: e.target.checked })} /> Starred</label>
          {canEdit ? <Button size="sm" variant="accent" className="w-full" disabled={saving} onClick={async () => { setSaving(true); await onSave({ ...d, tags: d.tags.split(",") }); setSaving(false); }}>{saving ? "Saving…" : "Save"}</Button> : null}
          <a href={photo.url} target="_blank" rel="noreferrer" className="block text-center text-xs text-muted-foreground hover:text-foreground">Open original</a>
        </div>
      </div>
    </div>
  );
}
