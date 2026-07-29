"use client";

import * as React from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Columns3, Download, FileText, Info, List,
  Loader2, Pencil, Plus, Table as TableIcon, Trash2, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TrainingDoc = {
  id: string;
  title: string;
  content: string;
  source_name: string | null;
  file_path: string | null;
  enabled: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type View = "list" | "table" | "kanban" | "calendar";
const VIEW_ICONS = [["list", List], ["table", TableIcon], ["kanban", Columns3], ["calendar", CalendarDays]] as const;

// File types whose text we can read in-browser and store as training content.
const TEXT_EXT = ["txt", "md", "markdown", "csv", "json", "html", "htm", "rtf", "log"];

async function jsonOk<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || (data as { error?: string }).error) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; }
}

async function downloadDoc(doc: TrainingDoc) {
  if (!doc.file_path) return;
  try {
    const { url } = await jsonOk<{ url: string }>(
      await fetch("/api/agent/training/media-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.file_path, download: doc.source_name ?? "document" }),
      }),
    );
    const a = document.createElement("a");
    a.href = url; a.download = doc.source_name ?? "document"; a.click();
  } catch { /* best-effort */ }
}

export function AgentTrainingPanel() {
  const [docs, setDocs] = React.useState<TrainingDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>("list");
  const [editing, setEditing] = React.useState<TrainingDoc | null>(null);
  const [viewing, setViewing] = React.useState<TrainingDoc | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { docs } = await jsonOk<{ docs: TrainingDoc[] }>(await fetch("/api/agent/training", { cache: "no-store" }));
      setDocs(docs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load training docs.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function toggle(doc: TrainingDoc) {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, enabled: !d.enabled } : d)));
    setViewing((v) => (v && v.id === doc.id ? { ...v, enabled: !v.enabled } : v));
    await fetch(`/api/agent/training/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !doc.enabled }),
    }).catch(() => void load());
  }
  async function remove(doc: TrainingDoc) {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setViewing(null);
    await fetch(`/api/agent/training/${doc.id}`, { method: "DELETE" }).catch(() => void load());
  }

  const props = { onOpen: setViewing, onToggle: toggle, onDelete: remove };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What to add to train Bolt</p>
          <p className="mt-1">
            Enabled docs are fed to Bolt as authoritative CMI knowledge. Good candidates: company overview &amp; services,
            pricing rules and rate cards, SOP / process guides, contract &amp; SOW boilerplate, warranty terms, brand voice
            and email templates, an FAQ, vendor/subcontractor lists, and naming conventions. Upload plain text, Markdown,
            CSV, or <strong>PDF</strong> (text is extracted automatically) — or paste text directly.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Training Documents <span className="text-muted-foreground">({docs.length})</span></div>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {VIEW_ICONS.map(([v, Icon]) => (
              <button key={v} type="button" title={v} onClick={() => setView(v)} className={cn("inline-flex h-7 w-7 items-center justify-center rounded", view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /></button>
            ))}
          </div>
        </div>
        <Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Add Document</Button>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          No training documents yet. Add one to give Bolt CMI-specific knowledge.
        </div>
      ) : view === "list" ? (
        <DocList docs={docs} {...props} />
      ) : view === "table" ? (
        <DocTable docs={docs} {...props} />
      ) : view === "kanban" ? (
        <DocKanban docs={docs} {...props} />
      ) : (
        <DocCalendar docs={docs} onOpen={setViewing} />
      )}

      {viewing && (
        <ViewModal
          doc={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { const d = viewing; setViewing(null); setEditing(d); }}
          onToggle={() => void toggle(viewing)}
          onDelete={() => void remove(viewing)}
        />
      )}
      {(creating || editing) && (
        <TrainingEditor
          doc={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

type RowProps = { onOpen: (d: TrainingDoc) => void; onToggle: (d: TrainingDoc) => void; onDelete: (d: TrainingDoc) => void };

function EnabledSwitch({ doc, onToggle }: { doc: TrainingDoc; onToggle: (d: TrainingDoc) => void }) {
  return (
    <button type="button" role="switch" aria-checked={doc.enabled} aria-label={`Toggle ${doc.title}`}
      onClick={(e) => { e.stopPropagation(); onToggle(doc); }}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", doc.enabled ? "bg-accent" : "bg-muted")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", doc.enabled ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

function DocList({ docs, onOpen, onToggle, onDelete }: { docs: TrainingDoc[] } & RowProps) {
  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div key={doc.id} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <button type="button" onClick={() => onOpen(doc)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">{doc.title || "Untitled"}</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{doc.content || "(no content)"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {doc.source_name ? `${doc.source_name} · ` : ""}{doc.content.length.toLocaleString()} chars · {fmt(doc.created_at)}
            </div>
          </button>
          {doc.file_path && (
            <button type="button" onClick={() => void downloadDoc(doc)} aria-label="Download" title="Download original" className="mt-0.5 text-muted-foreground transition hover:text-accent"><Download className="h-4 w-4" /></button>
          )}
          <EnabledSwitch doc={doc} onToggle={onToggle} />
          <button type="button" onClick={() => onDelete(doc)} aria-label="Delete" className="mt-0.5 text-muted-foreground transition hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

function DocTable({ docs, onOpen, onToggle, onDelete }: { docs: TrainingDoc[] } & RowProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-left">{["Title", "Source", "Size", "Added", "Enabled", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="cursor-pointer px-4 py-2.5 font-medium" onClick={() => onOpen(doc)}>{doc.title || "Untitled"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {doc.file_path ? (
                  <button type="button" onClick={() => void downloadDoc(doc)} className="inline-flex items-center gap-1 text-accent hover:underline"><Download className="h-3 w-3" />{doc.source_name || "file"}</button>
                ) : (doc.source_name || "—")}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{doc.content.length.toLocaleString()} chars</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmt(doc.created_at)}</td>
              <td className="px-4 py-2.5"><EnabledSwitch doc={doc} onToggle={onToggle} /></td>
              <td className="px-4 py-2.5"><button type="button" onClick={() => onDelete(doc)} aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocKanban({ docs, onOpen, onToggle, onDelete }: { docs: TrainingDoc[] } & RowProps) {
  const columns = [
    { key: "enabled", label: "Active (used by Bolt)", items: docs.filter((d) => d.enabled) },
    { key: "disabled", label: "Disabled", items: docs.filter((d) => !d.enabled) },
  ];
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="flex w-80 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">{col.label}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {col.items.map((doc) => (
              <div key={doc.id} className="rounded-md border border-border bg-background p-2.5">
                <button type="button" onClick={() => onOpen(doc)} className="w-full text-left">
                  <div className="truncate text-sm font-medium">{doc.title || "Untitled"}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{doc.content || "(no content)"}</div>
                </button>
                <div className="mt-2 flex items-center gap-2">
                  {doc.file_path && <button type="button" onClick={() => void downloadDoc(doc)} aria-label="Download" className="text-muted-foreground hover:text-accent"><Download className="h-3.5 w-3.5" /></button>}
                  <EnabledSwitch doc={doc} onToggle={onToggle} />
                  <button type="button" onClick={() => onDelete(doc)} aria-label="Delete" className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            {col.items.length === 0 && <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">None</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocCalendar({ docs, onOpen }: { docs: TrainingDoc[]; onOpen: (d: TrainingDoc) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const byDay = React.useMemo(() => {
    const map = new Map<string, TrainingDoc[]>();
    for (const d of docs) {
      const dt = new Date(d.created_at);
      if (Number.isNaN(dt.getTime())) continue;
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      (map.get(k) ?? map.set(k, []).get(k)!).push(d);
    }
    return map;
  }, [docs]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date();
  const step = (delta: number) => setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-24 bg-background" />;
          const items = byDay.get(`${cursor.y}-${cursor.m}-${day}`) ?? [];
          const isToday = today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === day;
          return (
            <div key={day} className="min-h-24 bg-background p-1.5">
              <div className={cn("mb-1 text-[11px] font-medium", isToday ? "text-accent" : "text-muted-foreground")}>{day}</div>
              <div className="space-y-1">
                {items.slice(0, 4).map((d) => (
                  <button key={d.id} type="button" onClick={() => onOpen(d)} title={d.title} className="block w-full truncate rounded bg-accent/10 px-1.5 py-0.5 text-left text-[10px] text-accent hover:bg-accent/20">{d.title || "Untitled"}</button>
                ))}
                {items.length > 4 && <div className="px-1.5 text-[10px] text-muted-foreground">+{items.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewModal({ doc, onClose, onEdit, onToggle, onDelete }: { doc: TrainingDoc; onClose: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative my-6 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold">{doc.title || "Untitled"}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", doc.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{doc.enabled ? "Active" : "Disabled"}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <div className="mb-3 text-[11px] text-muted-foreground">
            {doc.source_name ? `${doc.source_name} · ` : ""}{doc.content.length.toLocaleString()} chars · added {fmt(doc.created_at)}{doc.created_by_name ? ` by ${doc.created_by_name}` : ""}
          </div>
          <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-7 text-foreground">
            {doc.content || <span className="text-muted-foreground">(no text content)</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            <button type="button" role="switch" aria-checked={doc.enabled} onClick={onToggle} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", doc.enabled ? "bg-accent" : "bg-muted")}>
              <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", doc.enabled ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {doc.file_path && <Button size="sm" variant="outline" onClick={() => void downloadDoc(doc)}><Download className="h-3.5 w-3.5" /> Download</Button>}
            <Button size="sm" variant="accent" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingEditor({ doc, onClose, onSaved }: { doc: TrainingDoc | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = React.useState(doc?.title ?? "");
  const [content, setContent] = React.useState(doc?.content ?? "");
  const [sourceName, setSourceName] = React.useState<string | null>(doc?.source_name ?? null);
  const [filePath, setFilePath] = React.useState<string | null>(doc?.file_path ?? null);
  const [busy, setBusy] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [error, setError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setReading(true); setError("");
    setSourceName(file.name);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isPdf = ext === "pdf" || file.type === "application/pdf";

    // Store the original file (best-effort) — also needed for server-side PDF extraction.
    let uploadedPath: string | null = null;
    try {
      const { path, signedUrl } = await jsonOk<{ path: string; signedUrl: string }>(
        await fetch("/api/agent/training/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) }),
      );
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" } });
      uploadedPath = path;
      setFilePath(path);
    } catch { /* file storage is optional (unless PDF, which needs it) */ }

    if (TEXT_EXT.includes(ext) || file.type.startsWith("text/")) {
      try {
        const text = (await file.text()).slice(0, 200_000);
        setContent((prev) => prev || text);
      } catch { setError("Could not read this file's text — paste it below."); }
    } else if (isPdf && uploadedPath) {
      try {
        const { text } = await jsonOk<{ text: string }>(
          await fetch("/api/agent/training/extract-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: uploadedPath }) }),
        );
        setContent((prev) => prev || text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not extract text from this PDF. Paste its key text below.");
      }
    } else {
      setError("This file type can't be read automatically. It's stored for reference — paste its key text below so Bolt can use it.");
    }
    setReading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const payload = { title: title.trim(), content, source_name: sourceName, file_path: filePath };
      if (doc) {
        await jsonOk(await fetch(`/api/agent/training/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      } else {
        await jsonOk(await fetch("/api/agent/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative my-6 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{doc ? "Edit Training Document" : "Add Training Document"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="td-title" className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
            <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CMI Pricing Rules" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="td-content" className="text-xs font-medium text-muted-foreground">Content <span className="text-muted-foreground/70">(what Bolt reads)</span></label>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50">
                {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload a file (text, Markdown, CSV, PDF)
              </button>
            </div>
            <input ref={fileRef} type="file" hidden accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,.log,.pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            <Textarea id="td-content" value={content} onChange={(e) => setContent(e.target.value)} rows={12}
              placeholder="Paste or type the knowledge Bolt should learn — process notes, pricing rules, FAQs, brand voice…" />
            {sourceName && <p className="mt-1 text-[11px] text-muted-foreground">Source file: {sourceName}{filePath ? " (stored)" : ""}</p>}
          </div>
          {error && <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy || reading || (!title.trim() && !content.trim())}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
