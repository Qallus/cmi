"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight, Columns3, Inbox, LayoutGrid, List, Loader2, Pencil, SquareStack, Table2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "./canvas-api";
import type { CanvasProject, CanvasStatus } from "@/lib/canvas/types";

type View = "list" | "table" | "cards" | "kanban" | "calendar";

const VIEWS: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "list", label: "List", icon: List },
  { key: "table", label: "Table", icon: Table2 },
  { key: "cards", label: "Cards", icon: LayoutGrid },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "calendar", label: "Calendar", icon: Calendar },
];

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-[#c87f3a]/15 text-[#c87f3a]",
  in_review: "bg-info/15 text-info",
  responded: "bg-[#2e7d5b]/15 text-[#2e7d5b]",
};
const STATUS_LABEL: Record<string, string> = { submitted: "Submitted", in_review: "In review", responded: "Responded" };
const KANBAN_COLS: CanvasStatus[] = ["submitted", "in_review", "responded"];

function whenOf(b: CanvasProject): string { return b.submitted_at ?? b.updated_at; }

export function BriefList() {
  const [briefs, setBriefs] = React.useState<CanvasProject[] | null>(null);
  const [view, setView] = React.useState<View>("list");
  const [error, setError] = React.useState<string | null>(null);
  const [isSuper, setIsSuper] = React.useState(false);
  const [urls, setUrls] = React.useState<Record<string, string>>({});

  const load = React.useCallback(() => {
    api.apiListCanvases().then((all) => setBriefs(all.filter((c) => c.status !== "draft"))).catch((e) => setError(e instanceof Error ? e.message : "Could not load briefs."));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d: { user?: { role?: string } }) => setIsSuper(d.user?.role === "super_admin")).catch(() => {});
  }, []);

  // Resolve cover images for image-bearing views.
  React.useEffect(() => {
    if (!briefs || (view !== "cards" && view !== "kanban")) return;
    for (const b of briefs) {
      if (b.cover_path && !urls[b.id]) {
        api.apiMediaUrl(b.cover_path).then((u) => setUrls((m) => ({ ...m, [b.id]: u }))).catch(() => {});
      }
    }
  }, [briefs, view, urls]);

  async function setStatus(id: string, status: CanvasStatus) {
    setBriefs((prev) => prev?.map((b) => (b.id === id ? { ...b, status } : b)) ?? prev);
    try { await api.apiUpdateCanvas(id, { status }); } catch { load(); }
  }
  async function del(id: string) {
    if (!window.confirm("Delete this canvas permanently? This can't be undone.")) return;
    setBriefs((prev) => prev?.filter((b) => b.id !== id) ?? prev);
    try { await api.apiDeleteCanvas(id); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); load(); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Project Canvas</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Canvas Briefs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Project briefs clients have submitted through Project Canvas.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" onClick={() => setView(v.key)} title={v.label} aria-pressed={view === v.key}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition", view === v.key ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted")}>
              <v.icon className="h-4 w-4" /><span className="hidden md:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-destructive">{error}</div>}

      {briefs === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"><Inbox className="h-6 w-6" /> No submitted briefs yet.</div>
      ) : view === "list" ? (
        <ListView briefs={briefs} isSuper={isSuper} onDelete={del} />
      ) : view === "table" ? (
        <TableView briefs={briefs} isSuper={isSuper} onDelete={del} />
      ) : view === "cards" ? (
        <CardsView briefs={briefs} urls={urls} isSuper={isSuper} onDelete={del} />
      ) : view === "kanban" ? (
        <KanbanView briefs={briefs} urls={urls} isSuper={isSuper} onDelete={del} onStatus={setStatus} />
      ) : (
        <CalendarView briefs={briefs} />
      )}
    </div>
  );
}

function Actions({ id, isSuper, onDelete }: { id: string; isSuper: boolean; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={`/dashboard/canvas-briefs/${id}`} className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10">Open</Link>
      {isSuper && (
        <>
          <Link href={`/dashboard/canvas/${id}`} title="Edit in canvas" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></Link>
          <button type="button" title="Delete" onClick={() => onDelete(id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_TONE[status] ?? "bg-muted text-muted-foreground")}>{STATUS_LABEL[status] ?? status}</span>;
}

function ListView({ briefs, isSuper, onDelete }: { briefs: CanvasProject[]; isSuper: boolean; onDelete: (id: string) => void }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {briefs.map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-3">
          <StatusBadge status={b.status} />
          <Link href={`/dashboard/canvas-briefs/${b.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{b.title}</Link>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{new Date(whenOf(b)).toLocaleDateString()}</span>
          <Actions id={b.id} isSuper={isSuper} onDelete={onDelete} />
        </div>
      ))}
    </div>
  );
}

function TableView({ briefs, isSuper, onDelete }: { briefs: CanvasProject[]; isSuper: boolean; onDelete: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 font-semibold">Title</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 font-semibold">Submitted</th><th className="px-4 py-2.5 text-right font-semibold">Actions</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {briefs.map((b) => (
            <tr key={b.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5"><Link href={`/dashboard/canvas-briefs/${b.id}`} className="font-medium hover:text-accent">{b.title}</Link></td>
              <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
              <td className="px-4 py-2.5 text-muted-foreground">{new Date(whenOf(b)).toLocaleString()}</td>
              <td className="px-4 py-2.5"><div className="flex justify-end"><Actions id={b.id} isSuper={isSuper} onDelete={onDelete} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cover({ url, className }: { url?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-[#20261f] text-white/50", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : <SquareStack className="h-6 w-6" />}
    </div>
  );
}

function CardsView({ briefs, urls, isSuper, onDelete }: { briefs: CanvasProject[]; urls: Record<string, string>; isSuper: boolean; onDelete: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {briefs.map((b) => (
        <div key={b.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <Link href={`/dashboard/canvas-briefs/${b.id}`}><Cover url={urls[b.id]} className="h-40" /></Link>
          <div className="p-4">
            <div className="flex items-center justify-between gap-2"><StatusBadge status={b.status} /><span className="font-mono text-[10px] text-muted-foreground">{new Date(whenOf(b)).toLocaleDateString()}</span></div>
            <Link href={`/dashboard/canvas-briefs/${b.id}`} className="mt-2 block font-medium hover:text-accent">{b.title}</Link>
            <div className="mt-2"><Actions id={b.id} isSuper={isSuper} onDelete={onDelete} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ briefs, urls, isSuper, onDelete, onStatus }: { briefs: CanvasProject[]; urls: Record<string, string>; isSuper: boolean; onDelete: (id: string) => void; onStatus: (id: string, s: CanvasStatus) => void }) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {KANBAN_COLS.map((col) => {
        const items = briefs.filter((b) => b.status === col);
        return (
          <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) onStatus(dragId, col); setDragId(null); }}
            className="rounded-xl border border-border bg-muted/20 p-2">
            <div className="flex items-center justify-between px-2 py-1.5"><StatusBadge status={col} /><span className="text-xs text-muted-foreground">{items.length}</span></div>
            <div className="space-y-2">
              {items.map((b) => (
                <div key={b.id} draggable onDragStart={() => setDragId(b.id)} onDragEnd={() => setDragId(null)}
                  className="cursor-grab overflow-hidden rounded-lg border border-border bg-card active:cursor-grabbing">
                  <Link href={`/dashboard/canvas-briefs/${b.id}`}><Cover url={urls[b.id]} className="h-24" /></Link>
                  <div className="p-2.5">
                    <Link href={`/dashboard/canvas-briefs/${b.id}`} className="block truncate text-sm font-medium hover:text-accent">{b.title}</Link>
                    <div className="mt-1 flex items-center justify-between"><span className="text-[10px] text-muted-foreground">{new Date(whenOf(b)).toLocaleDateString()}</span><Actions id={b.id} isSuper={isSuper} onDelete={onDelete} /></div>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Drop here</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ briefs }: { briefs: CanvasProject[] }) {
  const [month, setMonth] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = new Date(month.y, month.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, CanvasProject[]>();
  for (const b of briefs) {
    const d = new Date(whenOf(b));
    if (d.getFullYear() === month.y && d.getMonth() === month.m) {
      const day = d.getDate();
      byDay.set(day, [...(byDay.get(day) ?? []), b]);
    }
  }
  const monthName = first.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMonth((s) => ({ y: s.m === 0 ? s.y - 1 : s.y, m: s.m === 0 ? 11 : s.m - 1 }))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-sm font-semibold">{monthName}</div>
        <button type="button" onClick={() => setMonth((s) => ({ y: s.m === 11 ? s.y + 1 : s.y, m: s.m === 11 ? 0 : s.m + 1 }))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className={cn("min-h-[76px] rounded-md border p-1", day ? "border-border" : "border-transparent")}>
            {day && <div className="mb-1 text-[11px] text-muted-foreground">{day}</div>}
            <div className="space-y-1">
              {(byDay.get(day ?? -1) ?? []).map((b) => (
                <Link key={b.id} href={`/dashboard/canvas-briefs/${b.id}`} title={b.title} className={cn("block truncate rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_TONE[b.status] ?? "bg-muted")}>{b.title}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
