"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, File as FileIcon, FileArchive, FileAudio, FileCode, FileSpreadsheet,
  FileText, FileVideo, Folder, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRow, FolderRow } from "@/lib/files/types";
import { extOf, fmtSize, previewKind } from "./cloud-preview";

export type Layout = "grid" | "list" | "table" | "calendar";
export type DragPayload = { id: string; kind: "file" | "folder" }[];
export const DND_MIME = "application/x-cmi-cloud-items";

export type ViewProps = {
  folders: FolderRow[];
  files: FileRow[];
  selected: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onOpenFolder: (f: FolderRow) => void;
  onPreview: (f: FileRow) => void;
  menu: (kind: "file" | "folder", row: FileRow | FolderRow) => React.ReactNode;
  dnd: {
    enabled: boolean;
    reorderable: boolean;
    onDragStart: (e: React.DragEvent, item: { id: string; kind: "file" | "folder" }) => void;
    onDropOnFolder: (e: React.DragEvent, folderId: string) => void;
    onDropBefore: (e: React.DragEvent, index: number) => void;
  };
};

// ── Icons ────────────────────────────────────────────────────────────────

export function KindIcon({ file, className }: { file: Pick<FileRow, "name" | "mime_type" | "size_bytes">; className?: string }) {
  const kind = previewKind(file);
  const ext = extOf(file.name);
  const Icon =
    kind === "image" ? ImageIcon
    : kind === "video" ? FileVideo
    : kind === "audio" ? FileAudio
    : kind === "table" || ["xlsx", "xls", "xlsm", "ods"].includes(ext) ? FileSpreadsheet
    : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? FileArchive
    : ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "sql", "sh", "xml", "yml", "yaml"].includes(ext) ? FileCode
    : kind === "text" || kind === "pdf" || kind === "office" ? FileText
    : FileIcon;
  const tint =
    kind === "image" ? "text-emerald-600 dark:text-emerald-400"
    : kind === "video" ? "text-violet-600 dark:text-violet-400"
    : kind === "audio" ? "text-pink-600 dark:text-pink-400"
    : kind === "table" || ["xlsx", "xls", "xlsm", "ods"].includes(ext) ? "text-green-700 dark:text-green-400"
    : kind === "pdf" ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";
  return <Icon className={cn(className, tint)} />;
}

// Thumbnail for images; falls back to the type icon.
export function FileThumb({ file, className }: { file: FileRow; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!file.thumbnail_key || failed) return <KindIcon file={file} className={className ?? "h-10 w-10"} />;
  // eslint-disable-next-line @next/next/no-img-element -- streamed from storage, not optimizable
  return <img src={`/api/files/${file.id}/download?thumb=1`} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

// ── Shared item behaviour ────────────────────────────────────────────────

function useDropTarget() {
  const [over, setOver] = React.useState(false);
  return {
    over,
    handlers: (onDrop: (e: React.DragEvent) => void, active: boolean) => ({
      onDragOver: (e: React.DragEvent) => { if (!active) return; e.preventDefault(); e.stopPropagation(); setOver(true); },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => { setOver(false); if (!active) return; e.preventDefault(); e.stopPropagation(); onDrop(e); },
    }),
  };
}

function FolderTile({ folder, p, children, className }: { folder: FolderRow; p: ViewProps; children: React.ReactNode; className?: string }) {
  const { over, handlers } = useDropTarget();
  return (
    <div
      draggable={p.dnd.enabled}
      onDragStart={(e) => p.dnd.onDragStart(e, { id: folder.id, kind: "folder" })}
      {...handlers((e) => p.dnd.onDropOnFolder(e, folder.id), p.dnd.enabled)}
      onDoubleClick={() => p.onOpenFolder(folder)}
      className={cn(className, over && "ring-2 ring-accent ring-offset-1 ring-offset-background")}
    >
      {children}
    </div>
  );
}

// ── Grid ─────────────────────────────────────────────────────────────────

export function GridView(p: ViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {p.folders.map((f) => (
        <FolderTile key={f.id} folder={f} p={p}
          className="group relative cursor-pointer rounded-lg border border-border bg-card p-3 transition hover:border-accent hover:shadow-sm">
          <div onClick={() => p.onOpenFolder(f)} className="flex flex-col items-center gap-2">
            <Folder className="h-10 w-10 text-accent" />
            <span className="line-clamp-2 break-all text-center text-xs font-medium">{f.name}</span>
          </div>
          <div className="absolute right-1 top-1">{p.menu("folder", f)}</div>
        </FolderTile>
      ))}
      {p.files.map((f, i) => (
        <ItemDropWrapper key={f.id} p={p} index={i}>
          <div
            draggable={p.dnd.enabled}
            onDragStart={(e) => p.dnd.onDragStart(e, { id: f.id, kind: "file" })}
            onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? p.onSelect(f.id, true) : p.onPreview(f))}
            className={cn("group relative cursor-pointer rounded-lg border bg-card p-3 transition hover:border-accent hover:shadow-sm",
              p.selected.has(f.id) ? "border-accent ring-1 ring-accent" : "border-border")}
          >
            <div className="mb-2 grid h-24 place-items-center overflow-hidden rounded-md bg-muted/40">
              <FileThumb file={f} />
            </div>
            <div className="line-clamp-2 break-all text-center text-xs font-medium">{f.name}</div>
            <div className="text-center text-[10px] text-muted-foreground">{fmtSize(f.size_bytes)}</div>
            <SelectBox id={f.id} p={p} />
            <div className="absolute right-1 top-1">{p.menu("file", f)}</div>
          </div>
        </ItemDropWrapper>
      ))}
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────

export function ListView(p: ViewProps) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {p.folders.map((f) => (
        <FolderTile key={f.id} folder={f} p={p} className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
          <Folder className="h-5 w-5 shrink-0 text-accent" />
          <button type="button" onClick={() => p.onOpenFolder(f)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent">{f.name}</button>
          <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">Folder</span>
          {p.menu("folder", f)}
        </FolderTile>
      ))}
      {p.files.map((f, i) => (
        <ItemDropWrapper key={f.id} p={p} index={i}>
          <div draggable={p.dnd.enabled} onDragStart={(e) => p.dnd.onDragStart(e, { id: f.id, kind: "file" })}
            onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? p.onSelect(f.id, true) : p.onPreview(f))}
            className={cn("group flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40", p.selected.has(f.id) && "bg-accent/10")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-muted/40"><FileThumb file={f} className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
            <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">{fmtSize(f.size_bytes)}</span>
            <span className="hidden w-28 shrink-0 text-xs text-muted-foreground md:block">{fmtDate(f.updated_at)}</span>
            {p.menu("file", f)}
          </div>
        </ItemDropWrapper>
      ))}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

type SortKey = "name" | "type" | "size" | "modified";

export function TableView(p: ViewProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const val = (f: FileRow, k: SortKey) =>
    k === "name" ? f.name.toLowerCase() : k === "type" ? extOf(f.name) : k === "size" ? (f.size_bytes ?? 0) : f.updated_at;
  const files = [...p.files].sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const th = (key: SortKey, label: string, cls?: string) => (
    <th className={cn("px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", cls)}>
      <button type="button" className="hover:text-foreground" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="border-b border-border">
          <tr>{th("name", "Name")}{th("type", "Type", "w-24")}{th("size", "Size", "w-24")}{th("modified", "Modified", "w-36")}<th className="w-10" /></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {p.folders.map((f) => (
            <tr key={f.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <FolderTile folder={f} p={p} className="flex items-center gap-2">
                  <Folder className="h-4 w-4 shrink-0 text-accent" />
                  <button type="button" onClick={() => p.onOpenFolder(f)} className="truncate font-medium hover:text-accent">{f.name}</button>
                </FolderTile>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">Folder</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(f.updated_at)}</td>
              <td className="px-2 py-2">{p.menu("folder", f)}</td>
            </tr>
          ))}
          {files.map((f) => (
            <tr key={f.id} draggable={p.dnd.enabled} onDragStart={(e) => p.dnd.onDragStart(e, { id: f.id, kind: "file" })}
              onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? p.onSelect(f.id, true) : p.onPreview(f))}
              className={cn("cursor-pointer hover:bg-muted/40", p.selected.has(f.id) && "bg-accent/10")}>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2"><KindIcon file={f} className="h-4 w-4 shrink-0" /><span className="truncate">{f.name}</span></span>
              </td>
              <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{extOf(f.name) || "—"}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{fmtSize(f.size_bytes)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(f.updated_at)}</td>
              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>{p.menu("file", f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Calendar (day / month / year, by modified date) ──────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function CalendarView({ files, onPreview, menu }: Pick<ViewProps, "files" | "onPreview" | "menu">) {
  const [mode, setMode] = React.useState<"day" | "month" | "year">("month");
  const [cursor, setCursor] = React.useState(new Date());
  const today = new Date();

  const byDay = React.useMemo(() => {
    const m = new Map<string, FileRow[]>();
    for (const f of files) {
      const k = dayKey(f.updated_at);
      const list = m.get(k) ?? [];
      list.push(f);
      m.set(k, list);
    }
    return m;
  }, [files]);

  const move = (n: number) => setCursor((c) =>
    mode === "day" ? addDays(c, n) : mode === "month" ? new Date(c.getFullYear(), c.getMonth() + n, 1) : new Date(c.getFullYear() + n, c.getMonth(), 1));

  const title = mode === "day"
    ? cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : mode === "month" ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : String(cursor.getFullYear());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="px-2 py-1.5 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="border-x border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="px-2 py-1.5 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h3 className="font-semibold">{title}</h3>
        <div className="ml-auto flex overflow-hidden rounded-md border border-border text-xs">
          {(["day", "month", "year"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn("px-3 py-1.5 font-medium capitalize", mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{m}</button>
          ))}
        </div>
      </div>

      {mode === "day" && <DayList files={byDay.get(cursor.toISOString().slice(0, 10)) ?? []} onPreview={onPreview} menu={menu} />}

      {mode === "month" && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
          </div>
          <MonthGrid cursor={cursor} today={today} byDay={byDay} onPreview={onPreview} onPickDay={(d) => { setCursor(d); setMode("day"); }} />
        </div>
      )}

      {mode === "year" && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => {
            const count = [...byDay.entries()].filter(([k]) => { const d = new Date(k); return d.getFullYear() === cursor.getFullYear() && d.getMonth() === m; })
              .reduce((s, [, list]) => s + list.length, 0);
            return (
              <button key={m} type="button" onClick={() => { setCursor(new Date(cursor.getFullYear(), m, 1)); setMode("month"); }}
                className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-accent">
                <div className="font-medium">{new Date(cursor.getFullYear(), m, 1).toLocaleDateString("en-US", { month: "long" })}</div>
                <div className="text-xs text-muted-foreground">{count} file{count === 1 ? "" : "s"}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthGrid({ cursor, today, byDay, onPreview, onPickDay }: {
  cursor: Date; today: Date; byDay: Map<string, FileRow[]>; onPreview: (f: FileRow) => void; onPickDay: (d: Date) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7);
  return (
    <>
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, w * 7 + i);
            const list = byDay.get(d.toISOString().slice(0, 10)) ?? [];
            const outside = d.getMonth() !== cursor.getMonth();
            return (
              <div key={i} className={cn("min-h-[92px] border-r border-border p-1.5 last:border-r-0", outside && "bg-muted/20")}>
                <button type="button" onClick={() => onPickDay(d)}
                  className={cn("mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs hover:bg-muted",
                    sameDay(d, today) && "bg-accent font-semibold text-accent-foreground", outside && "text-muted-foreground/50")}>
                  {d.getDate()}
                </button>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((f) => (
                    <button key={f.id} type="button" onClick={() => onPreview(f)} title={f.name}
                      className="flex w-full items-center gap-1 truncate rounded bg-muted/60 px-1 py-0.5 text-left text-[10px] hover:bg-muted">
                      <KindIcon file={f} className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  {list.length > 3 && <button type="button" onClick={() => onPickDay(d)} className="px-1 text-[10px] text-accent hover:underline">+{list.length - 3} more</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function DayList({ files, onPreview, menu }: { files: FileRow[]; onPreview: (f: FileRow) => void; menu: ViewProps["menu"] }) {
  if (!files.length) return <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">Nothing was added or changed on this day.</div>;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {files.map((f) => (
        <div key={f.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40" onClick={() => onPreview(f)}>
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-muted/40"><FileThumb file={f} className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{new Date(f.updated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          {menu("file", f)}
        </div>
      ))}
    </div>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────

// Wraps an item so dropping on it inserts the dragged items before it.
function ItemDropWrapper({ p, index, children }: { p: ViewProps; index: number; children: React.ReactNode }) {
  const { over, handlers } = useDropTarget();
  const active = p.dnd.enabled && p.dnd.reorderable;
  return (
    <div className={cn("relative", over && active && "before:absolute before:-left-1.5 before:top-0 before:h-full before:w-0.5 before:rounded before:bg-accent")}
      {...handlers((e) => p.dnd.onDropBefore(e, index), active)}>
      {children}
    </div>
  );
}

function SelectBox({ id, p }: { id: string; p: ViewProps }) {
  const on = p.selected.has(id);
  return (
    <button type="button" aria-label={on ? "Deselect" : "Select"} aria-pressed={on}
      onClick={(e) => { e.stopPropagation(); p.onSelect(id, true); }}
      className={cn("absolute left-1 top-1 grid h-5 w-5 place-items-center rounded border bg-card/90 text-[10px] transition",
        on ? "border-accent bg-accent text-accent-foreground opacity-100" : "border-border opacity-0 group-hover:opacity-100")}>
      {on ? "✓" : ""}
    </button>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
