"use client";

// Add many punch items at once: dictate (record → transcribe → Bolt splits it
// into items), paste text, or import a .csv / .txt file. Everything lands in a
// preview you can trim before "Add".
import * as React from "react";
import { FileUp, Loader2, Mic, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioRecorder } from "@/components/audio/audio-recorder";
import { cn } from "@/lib/utils";
import { parseCsv } from "@/lib/csv";
import { PUNCH_PRIORITIES, type PunchItemDraft, type PunchPriority } from "@/lib/punch/types";
import { api, Modal, type PunchMeta } from "./shared";

type Mode = "dictate" | "paste" | "import";
type Row = PunchItemDraft & { key: number; include: boolean };
let seq = 1;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const COLS: Record<string, keyof PunchItemDraft | "assignee"> = {
  item: "title", title: "title", task: "title", punchitem: "title", description: "title",
  location: "location", room: "location", area: "location",
  trade: "trade", priority: "priority", due: "due_date", duedate: "due_date",
  notes: "notes", note: "notes", assignee: "assignee", assignedto: "assignee", assigned: "assignee",
};

function fromCsv(text: string, meta: PunchMeta): PunchItemDraft[] {
  const grid = parseCsv(text.replace(/^﻿/, ""));
  if (!grid.length) return [];
  const header = grid[0].map((h) => COLS[norm(h)] ?? null);
  // No recognizable header: treat the first column as the item text.
  if (!header.includes("title")) return grid.map((r) => ({ title: (r[0] ?? "").trim() })).filter((d) => d.title);
  return grid.slice(1).map((r) => {
    const d: PunchItemDraft & { assignee?: string } = { title: "" };
    header.forEach((k, i) => {
      const v = (r[i] ?? "").trim();
      if (!k || !v) return;
      if (k === "assignee") d.assigned_to = meta.staff.find((s) => s.name.toLowerCase() === v.toLowerCase())?.id ?? null;
      else if (k === "priority") d.priority = PUNCH_PRIORITIES.includes(v.toLowerCase() as PunchPriority) ? (v.toLowerCase() as PunchPriority) : "normal";
      else (d as Record<string, unknown>)[k] = v;
    });
    return d;
  }).filter((d) => d.title);
}

export function AddItemsDialog({ listTitle, meta, initialMode = "dictate", onClose, onAdd }: {
  listTitle: string;
  meta: PunchMeta;
  initialMode?: Mode;
  onClose: () => void;
  onAdd: (items: PunchItemDraft[]) => Promise<void>;
}) {
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [recording, setRecording] = React.useState(initialMode === "dictate");
  const [busy, setBusy] = React.useState<null | "transcribe" | "read" | "add">(null);
  const [by, setBy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function preview(items: PunchItemDraft[]) {
    if (!items.length) { setError("No items found in that."); return; }
    setRows((prev) => [...prev, ...items.map((i) => ({ ...i, key: seq++, include: true }))]);
  }

  async function read(t = text) {
    if (!t.trim()) return;
    setBusy("read"); setError(null);
    try {
      const res = await api<{ items: PunchItemDraft[]; by: string }>("/api/punch-lists/parse", { method: "POST", json: { text: t } });
      setBy(res.by);
      preview(res.items);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function transcribe(blob: Blob) {
    setRecording(false);
    setBusy("transcribe"); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "punch.webm", { type: blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Transcription failed.");
      setText(j.transcript);
      setBusy(null);
      await read(j.transcript);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setError(null);
    const content = await file.text();
    if (/\.(csv|tsv)$/i.test(file.name)) preview(fromCsv(content, meta));
    else { setText(content); await read(content); }
    if (fileRef.current) fileRef.current.value = "";
  }

  const included = rows.filter((r) => r.include);
  async function add() {
    setBusy("add"); setError(null);
    try {
      await onAdd(included.map(({ key: _k, include: _i, ...d }) => d));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const tab = (m: Mode, Icon: typeof Mic, label: string) => (
    <button type="button" onClick={() => { setMode(m); if (m === "dictate") setRecording(true); }}
      className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
        mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <Modal title={`Add items · ${listTitle}`} onClose={onClose} wide
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" onClick={() => void add()} disabled={!included.length || !!busy}>
          {busy === "add" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add {included.length || ""} item{included.length === 1 ? "" : "s"}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {tab("dictate", Mic, "Dictate")}
          {tab("paste", Type, "Type / paste")}
          {tab("import", FileUp, "Import")}
        </div>
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {mode === "dictate" && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Walk the site and say each item, e.g. “Kitchen: touch up paint by the pantry. Primary bath: re-caulk the tub.”</p>
            <Button size="sm" variant="accent" className="mt-3" onClick={() => setRecording(true)} disabled={!!busy}>
              <Mic className="h-4 w-4" /> {rows.length ? "Record more" : "Start recording"}
            </Button>
            {busy === "transcribe" && <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Transcribing…</div>}
          </div>
        )}

        {mode === "paste" && (
          <div className="space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
              placeholder={"One item per line, or a paragraph:\nKitchen - adjust upper cabinet door\nTouch up paint in hallway\nPrimary bath: re-caulk tub"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            <Button size="sm" variant="outline" onClick={() => void read()} disabled={!text.trim() || !!busy}>
              {busy === "read" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Read items
            </Button>
          </div>
        )}

        {mode === "import" && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              <strong>.csv</strong> with columns like Item, Room, Trade, Priority, Due, Assignee, Notes — or a <strong>.txt</strong> file Bolt reads into items.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <FileUp className="h-4 w-4" /> Choose file
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
          </div>
        )}

        {busy === "read" && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Bolt is reading the items…</div>}

        {rows.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{included.length} of {rows.length} selected{by === "bolt" ? " · tidied by Bolt" : ""}</span>
              <button type="button" className="hover:text-foreground" onClick={() => setRows([])}>Clear</button>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((r) => (
                <li key={r.key} className="flex items-start gap-3 px-3 py-2">
                  <input type="checkbox" className="mt-2.5 h-5 w-5" checked={r.include}
                    onChange={(e) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))} />
                  <div className="min-w-0 flex-1">
                    <input value={r.title} onChange={(e) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))}
                      className="h-9 w-full rounded border border-transparent bg-transparent px-1 text-sm hover:border-border focus:border-accent focus:outline-none" />
                    {(r.location || r.trade || (r.priority && r.priority !== "normal")) && (
                      <div className="px-1 text-[11px] text-muted-foreground">{[r.location, r.trade, r.priority !== "normal" ? r.priority : null].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AudioRecorder open={recording} onClose={() => setRecording(false)} onComplete={(blob) => void transcribe(blob)} />
    </Modal>
  );
}
