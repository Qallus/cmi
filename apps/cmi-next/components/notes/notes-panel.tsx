"use client";

import * as React from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Columns3, Download, List,
  Loader2, Paperclip, Plus, Search, Table as TableIcon, Upload, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NOTE_STATUSES, NOTE_STATUS_LABELS, noteColor, type NoteStatus, type StaffNote,
} from "@/lib/notes/types";
import { htmlToText } from "@/lib/notes/html";
import { apiCreateNote, apiDeleteNote, apiImportNotes, apiListNotes, apiUpdateNote, type StaffOption } from "./notes-api";
import { NoteEditor, type NoteEditorValue } from "./note-editor";

type View = "list" | "table" | "kanban" | "calendar";
const VIEW_ICONS = [["list", List], ["table", TableIcon], ["kanban", Columns3], ["calendar", CalendarDays]] as const;

const STATUS_TONE: Record<string, string> = {
  open: "bg-info/15 text-info", in_progress: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success", archived: "bg-muted text-muted-foreground",
};

function fmt(iso: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return iso; }
}

export function NotesPanel({ addNonce }: { addNonce: number }) {
  const [notes, setNotes] = React.useState<StaffNote[]>([]);
  const [me, setMe] = React.useState<{ id: string; name: string | null } | null>(null);
  const [staffOptions, setStaffOptions] = React.useState<StaffOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>("list");
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<StaffNote | null>(null);
  const [creating, setCreating] = React.useState(false);
  const importRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiListNotes();
      setNotes(data.notes); setMe(data.me); setStaffOptions(data.staffOptions);
    } catch { /* surfaced via empty state */ } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  // The Documents header "Add Note" button bumps addNonce.
  React.useEffect(() => { if (addNonce > 0) setCreating(true); }, [addNonce]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      htmlToText(n.body).toLowerCase().includes(q) ||
      (n.linked_staff ?? []).some((s) => s.name.toLowerCase().includes(q)) ||
      n.linked_emails.some((e) => e.includes(q)),
    );
  }, [notes, search]);

  async function saveNew(v: NoteEditorValue) {
    const note = await apiCreateNote(v as unknown as Record<string, unknown>);
    setNotes((prev) => [note, ...prev]);
    setCreating(false);
    void load(); // refresh joined linked-staff labels
  }
  async function saveEdit(v: NoteEditorValue) {
    if (!editing) return;
    const note = await apiUpdateNote(editing.id, v as unknown as Record<string, unknown>);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...note, linked_staff: n.linked_staff } : n)));
    setEditing(null);
    void load();
  }
  async function removeEditing() {
    if (!editing) return;
    await apiDeleteNote(editing.id);
    setNotes((prev) => prev.filter((n) => n.id !== editing.id));
    setEditing(null);
  }

  function exportNotes() {
    const payload = notes.map((n) => ({ title: n.title, body: n.body, status: n.status, color: n.color, due_date: n.due_date }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cmi-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importNotes(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : parsed.notes;
      if (!Array.isArray(arr)) throw new Error("bad shape");
      await apiImportNotes(arr);
      void load();
    } catch { /* ignore malformed import */ }
    if (importRef.current) importRef.current.value = "";
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 md:px-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" aria-label="Search notes"
            className="h-8 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {VIEW_ICONS.map(([v, Icon]) => (
            <button key={v} type="button" title={v} onClick={() => setView(v)} className={cn("inline-flex h-7 w-7 items-center justify-center rounded", view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /></button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportNotes}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Import</Button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importNotes(f); }} />
          <Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Add Note</Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {search ? `No notes match “${search}”.` : "No notes yet. Create your first with Add Note."}
          </div>
        ) : view === "list" ? (
          <div className="space-y-2">{filtered.map((n) => <NoteRow key={n.id} n={n} onOpen={() => setEditing(n)} />)}</div>
        ) : view === "table" ? (
          <NotesTable notes={filtered} onOpen={setEditing} />
        ) : view === "kanban" ? (
          <NotesKanban notes={filtered} onOpen={setEditing} />
        ) : (
          <NotesCalendar notes={filtered} onOpen={setEditing} />
        )}
      </div>

      {(creating || editing) && (
        <NoteEditor
          note={editing}
          staffOptions={staffOptions}
          canDelete={!!editing && editing.author_staff_id === me?.id}
          onSave={editing ? saveEdit : saveNew}
          onDelete={removeEditing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function LinkCount({ n }: { n: StaffNote }) {
  const count = (n.linked_staff?.length ?? n.linked_staff_ids.length) + n.linked_emails.length;
  if (!count) return null;
  return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" />{count}</span>;
}

function NoteRow({ n, onOpen }: { n: StaffNote; onOpen: () => void }) {
  const c = noteColor(n.color);
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition hover:border-accent/40" style={{ background: c.tint === "transparent" ? undefined : c.tint }}>
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.swatch }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{n.title || "Untitled"}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", STATUS_TONE[n.status])}>{NOTE_STATUS_LABELS[n.status]}</span>
        </span>
        {htmlToText(n.body) && <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{htmlToText(n.body)}</span>}
        <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {n.author_name && <span>{n.author_name}</span>}
          {n.due_date && <span>· due {fmt(n.due_date)}</span>}
          {n.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{n.attachments.length}</span>}
          <LinkCount n={n} />
        </span>
      </span>
    </button>
  );
}

function NotesTable({ notes, onOpen }: { notes: StaffNote[]; onOpen: (n: StaffNote) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-left">{["Title", "Status", "Author", "Linked", "Files", "Due", "Updated"].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {notes.map((n) => (
            <tr key={n.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onClick={() => onOpen(n)}>
              <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: noteColor(n.color).swatch }} /><span className="font-medium">{n.title || "Untitled"}</span></div></td>
              <td className="px-4 py-2.5"><span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", STATUS_TONE[n.status])}>{NOTE_STATUS_LABELS[n.status]}</span></td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{n.author_name ?? "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{(n.linked_staff?.length ?? n.linked_staff_ids.length) + n.linked_emails.length || "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{n.attachments.length || "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{n.due_date ? fmt(n.due_date) : "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmt(n.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesKanban({ notes, onOpen }: { notes: StaffNote[]; onOpen: (n: StaffNote) => void }) {
  const columns = NOTE_STATUSES.map((s) => ({ status: s, items: notes.filter((n) => n.status === s) }));
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.status} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">{NOTE_STATUS_LABELS[col.status]}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2 p-2">
            {col.items.map((n) => {
              const c = noteColor(n.color);
              return (
                <button key={n.id} type="button" onClick={() => onOpen(n)} className="w-full rounded-md border border-border bg-background p-2.5 text-left transition hover:border-accent/40" style={{ borderLeftColor: c.swatch, borderLeftWidth: 3 }}>
                  <div className="truncate text-sm font-medium">{n.title || "Untitled"}</div>
                  {htmlToText(n.body) && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{htmlToText(n.body)}</div>}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {n.due_date && <span>due {fmt(n.due_date)}</span>}
                    {n.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{n.attachments.length}</span>}
                    <LinkCount n={n} />
                  </div>
                </button>
              );
            })}
            {col.items.length === 0 && <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">None</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesCalendar({ notes, onOpen }: { notes: StaffNote[]; onOpen: (n: StaffNote) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  // Place notes on their due date; fall back to updated date when no due set.
  const byDay = React.useMemo(() => {
    const map = new Map<string, StaffNote[]>();
    for (const n of notes) {
      const d = new Date(n.due_date ?? n.updated_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map.get(k) ?? map.set(k, []).get(k)!).push(n);
    }
    return map;
  }, [notes]);

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
                {items.slice(0, 4).map((n) => (
                  <button key={n.id} type="button" onClick={() => onOpen(n)} title={n.title} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] hover:opacity-80" style={{ background: noteColor(n.color).tint === "transparent" ? "var(--muted)" : noteColor(n.color).tint }}>{n.title || "Untitled"}</button>
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
