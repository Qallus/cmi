"use client";

import * as React from "react";
import { FileText, Info, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
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

// File types whose text we can read in-browser and store as training content.
const TEXT_EXT = ["txt", "md", "markdown", "csv", "json", "html", "htm", "rtf", "log"];

async function jsonOk<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || (data as { error?: string }).error) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export function AgentTrainingPanel() {
  const [docs, setDocs] = React.useState<TrainingDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<TrainingDoc | null>(null);
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
    await fetch(`/api/agent/training/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !doc.enabled }),
    }).catch(() => void load());
  }
  async function remove(doc: TrainingDoc) {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    await fetch(`/api/agent/training/${doc.id}`, { method: "DELETE" }).catch(() => void load());
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* What to upload */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What to add to train Bolt</p>
          <p className="mt-1">
            Enabled docs are fed to Bolt as authoritative CMI knowledge. Good candidates: company overview &amp; services,
            pricing rules and rate cards, SOP / process guides, contract &amp; SOW boilerplate, warranty terms, brand voice
            and email templates, an FAQ, vendor/subcontractor lists, and naming conventions. Best formats are plain text,
            Markdown, or CSV; you can also paste text directly. (PDF/DOCX are stored for reference — paste their key text
            into the content box so Bolt can read it.)
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Training Documents <span className="text-muted-foreground">({docs.length})</span></div>
        <Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Add Document</Button>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          No training documents yet. Add one to give Bolt CMI-specific knowledge.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <button type="button" onClick={() => setEditing(doc)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium">{doc.title || "Untitled"}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{doc.content || "(no content)"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {doc.source_name ? `${doc.source_name} · ` : ""}{doc.content.length.toLocaleString()} chars
                  {doc.created_by_name ? ` · ${doc.created_by_name}` : ""}
                </div>
              </button>
              <button
                type="button" role="switch" aria-checked={doc.enabled} aria-label={`Toggle ${doc.title}`}
                onClick={() => void toggle(doc)}
                className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", doc.enabled ? "bg-accent" : "bg-muted")}
              >
                <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", doc.enabled ? "translate-x-5" : "translate-x-0.5")} />
              </button>
              <button type="button" onClick={() => void remove(doc)} aria-label="Delete" className="mt-0.5 text-muted-foreground transition hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
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

    // Store the original file for reference (best-effort).
    try {
      const { path, signedUrl } = await jsonOk<{ path: string; signedUrl: string }>(
        await fetch("/api/agent/training/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) }),
      );
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" } });
      setFilePath(path);
    } catch { /* file storage is optional */ }

    // Read the text so Bolt has something to learn from.
    if (TEXT_EXT.includes(ext) || file.type.startsWith("text/")) {
      try {
        const text = (await file.text()).slice(0, 200_000);
        setContent((prev) => prev || text);
      } catch { setError("Could not read this file's text — paste it below."); }
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
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
                {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload a file
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
          <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy || (!title.trim() && !content.trim())}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
