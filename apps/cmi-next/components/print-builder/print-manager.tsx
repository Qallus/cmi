"use client";

import * as React from "react";
import {
  Plus, Pencil, Trash2, Printer, Mail, LayoutList, Table2, LayoutGrid, FileText,
  Maximize2, Minimize2, Minus, X, Loader2, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blocksToHtml } from "@/components/email-builder/renderer";
import { PrintEditor } from "./print-editor";
import { printableHtml, openPrintWindow } from "./print-doc";
import { sizeLabel, pageDims } from "./page-sizes";
import type { PrintDoc, PrintListItem } from "./types";

type View = "list" | "table" | "cards";

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PrintManager() {
  const [prints, setPrints] = React.useState<PrintListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>("cards");
  const [editing, setEditing] = React.useState<PrintDoc | null | "new">(null);
  const [viewing, setViewing] = React.useState<PrintDoc | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { const res = await fetch("/api/prints"); const d = await res.json() as { prints?: PrintListItem[] }; setPrints(d.prints ?? []); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function fetchFull(id: string): Promise<PrintDoc | null> {
    const res = await fetch(`/api/prints/${id}`);
    const d = await res.json() as { print?: PrintDoc };
    return d.print ?? null;
  }
  async function openEdit(id: string) { const p = await fetchFull(id); if (p) setEditing(p); }
  async function openView(id: string) { const p = await fetchFull(id); if (p) setViewing(p); }

  async function duplicate(id: string) {
    const p = await fetchFull(id); if (!p) return;
    await fetch("/api/prints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, name: `${p.name} (copy)` }) });
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this print? This cannot be undone.")) return;
    setDeleting(id);
    try { await fetch(`/api/prints/${id}`, { method: "DELETE" }); setPrints((prev) => prev.filter((p) => p.id !== id)); }
    finally { setDeleting(null); }
  }
  function handleSaved(saved: PrintDoc) {
    setPrints((prev) => {
      const entry: PrintListItem = { id: saved.id, name: saved.name, page_size: saved.page_size, orientation: saved.orientation, status: saved.status, created_at: saved.created_at, updated_at: saved.updated_at };
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [entry, ...prev];
      const next = [...prev]; next[idx] = entry; return next;
    });
    setEditing(saved);
  }

  if (editing !== null) {
    return <div className="flex h-full flex-col"><PrintEditor print={editing === "new" ? null : editing} onSave={handleSaved} onBack={() => setEditing(null)} /></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Communications</div>
          <h2 className="mt-0.5 text-lg font-semibold">Prints</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {([["cards", LayoutGrid], ["list", LayoutList], ["table", Table2]] as const).map(([v, Icon]) => (
              <button key={v} type="button" onClick={() => setView(v)} title={v} className={cn("rounded p-1.5 transition", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
          <button type="button" onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"><Plus className="h-3.5 w-3.5" /> New Print</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : prints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            <p className="text-sm font-medium">No prints yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Build flyers, tear-sheets, and one-pagers, then print or save them as 8.5×11 PDFs.</p>
            <button type="button" onClick={() => setEditing("new")} className="mt-4 flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Create Print</button>
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {prints.map((p) => (
              <button key={p.id} type="button" onClick={() => void openView(p.id)} className="group overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-accent/40 hover:shadow-sm">
                <div className="relative flex items-center justify-center bg-muted/40" style={{ aspectRatio: p.orientation === "landscape" ? "11/8.5" : "8.5/11" }}>
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                  <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold", p.status === "active" ? "bg-success/15 text-success" : "bg-background/80 text-muted-foreground")}>{p.status}</span>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{sizeLabel(p.page_size)} · {timeAgo(p.updated_at)}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3">Name</th>{view === "table" ? <th className="px-4 py-3">Size</th> : null}<th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {prints.map((p) => (
                  <tr key={p.id} className="group cursor-pointer transition hover:bg-muted/30" onClick={() => void openView(p.id)}>
                    <td className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{p.name}</span></td>
                    {view === "table" ? <td className="px-4 py-3 text-xs text-muted-foreground">{sizeLabel(p.page_size)} · {p.orientation}</td> : null}
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", p.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{p.status}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(p.updated_at)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={() => void openEdit(p.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void duplicate(p.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void remove(p.id)} disabled={deleting === p.id} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing ? <PrintViewerModal print={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => { void remove(viewing.id); setViewing(null); }} /> : null}
    </div>
  );
}

// Large viewer modal with maximize / minimize / close + Print / Save-as-PDF / Email / Edit.
function PrintViewerModal({ print, onClose, onEdit, onDelete }: { print: PrintDoc; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [maximized, setMaximized] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [emailing, setEmailing] = React.useState(false);
  const html = React.useMemo(() => printableHtml(print.blocks, { pageSize: print.page_size, orientation: print.orientation, widthIn: print.width_in, heightIn: print.height_in }), [print]);
  const dims = pageDims(print.page_size, print.orientation, print.width_in, print.height_in);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function email() {
    const to = window.prompt("Send this print to which email address?");
    if (!to) return;
    setEmailing(true);
    try {
      const res = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "email", to, subject: print.name, body: blocksToHtml(print.blocks) }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Email failed."); }
      else alert(`Sent to ${to}.`);
    } finally { setEmailing(false); }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[70] flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[200px] truncate text-sm font-medium">{print.name}</span>
        <button type="button" onClick={() => setMinimized(false)} aria-label="Restore" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative z-10 flex w-full flex-col overflow-hidden border border-border bg-card shadow-2xl", maximized ? "m-2 max-w-none rounded-2xl sm:m-4" : "mt-auto max-w-5xl rounded-t-2xl sm:my-auto sm:rounded-2xl")} style={maximized ? { height: "calc(100dvh - 1rem)" } : { maxHeight: "92dvh" }}>
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-5 py-3">
          <FileText className="h-4 w-4 text-accent" />
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{print.name}</h3>
          <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMaximized((m) => !m)} aria-label={maximized ? "Restore" : "Full page"} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f4f4f4] p-6">
          <iframe srcDoc={html} title={print.name} sandbox="allow-same-origin" className="mx-auto block rounded border border-border bg-white shadow" style={{ width: Math.min(dims.wPx, maximized ? 1100 : 760), height: (Math.min(dims.wPx, maximized ? 1100 : 760)) * (dims.hIn / dims.wIn) }} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">{sizeLabel(print.page_size)} · {print.orientation}</span>
          <div className="flex-1" />
          <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
          <button type="button" onClick={onEdit} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button type="button" onClick={() => void email()} disabled={emailing} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">{emailing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Email</button>
          <button type="button" onClick={() => openPrintWindow(html)} className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"><Printer className="h-3.5 w-3.5" /> Print / Save as PDF</button>
        </div>
      </div>
    </div>
  );
}
