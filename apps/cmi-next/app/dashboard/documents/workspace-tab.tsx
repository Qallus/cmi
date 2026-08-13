"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, FileSignature, ScrollText, StickyNote, LayoutDashboard, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceHome } from "@/components/workspace/workspace-home";
import type { WorkspaceBundle } from "./documents-client";
import type { Document } from "./page";

type Props = {
  bundle: WorkspaceBundle;
  docs: Document[];
  onOpenDoc: (d: Document) => void;
  onOpenNotes: () => void;
};

type Hit =
  | { kind: "doc"; id: string; title: string; sub: string; doc: Document }
  | { kind: "workspace"; id: string; title: string; sub: string }
  | { kind: "note"; id: string; title: string; sub: string };

// The Workspace tab: a CMI overview (stat cards + unified search across every
// document type) sitting above the full Quip/Notion-style Workspace home.
export function WorkspaceTab({ bundle, docs, onOpenDoc, onOpenNotes }: Props) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [wsHits, setWsHits] = React.useState<{ id: string; title: string; snippet: string | null }[]>([]);

  const wsDocs = React.useMemo(() => [...bundle.mine, ...bundle.shared], [bundle.mine, bundle.shared]);

  const stats = React.useMemo(() => {
    const contracts = docs.filter((d) => d.type === "contract").length;
    const sows = docs.filter((d) => d.type === "sow").length;
    return [
      { key: "total", label: "All Documents", value: docs.length + wsDocs.length, icon: FileText },
      { key: "workspace", label: "Workspace Docs", value: wsDocs.length, icon: LayoutDashboard },
      { key: "contracts", label: "Contracts", value: contracts, icon: FileSignature },
      { key: "sows", label: "SOWs", value: sows, icon: ScrollText },
      { key: "notes", label: "Notes", value: bundle.notes.length, icon: StickyNote },
    ];
  }, [docs, wsDocs.length, bundle.notes.length]);

  // Body-text search across Workspace docs (client-side title search is instant;
  // the API adds full plain-text matches).
  React.useEffect(() => {
    const term = q.trim();
    if (!term) { setWsHits([]); return; }
    let ok = true;
    const t = setTimeout(() => {
      fetch(`/api/workspace/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => { if (ok && d.ok) setWsHits(d.results ?? []); })
        .catch(() => {});
    }, 220);
    return () => { ok = false; clearTimeout(t); };
  }, [q]);

  const results = React.useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Hit[] = [];
    for (const d of docs) {
      if (d.title.toLowerCase().includes(term) || (d.client ?? "").toLowerCase().includes(term) || (d.project ?? "").toLowerCase().includes(term)) {
        out.push({ kind: "doc", id: d.id, title: d.title, sub: `${d.type.toUpperCase()}${d.client ? ` · ${d.client}` : ""}`, doc: d });
      }
    }
    const wsSeen = new Set<string>();
    for (const w of wsDocs) {
      if (w.title.toLowerCase().includes(term)) { out.push({ kind: "workspace", id: w.id, title: w.title, sub: "Workspace" }); wsSeen.add(w.id); }
    }
    for (const h of wsHits) {
      if (!wsSeen.has(h.id)) { out.push({ kind: "workspace", id: h.id, title: h.title, sub: h.snippet ? h.snippet : "Workspace" }); wsSeen.add(h.id); }
    }
    for (const n of bundle.notes) {
      if (n.title.toLowerCase().includes(term) || (n.body ?? "").toLowerCase().includes(term)) {
        out.push({ kind: "note", id: n.id, title: n.title || "Untitled note", sub: "Note" });
      }
    }
    return out.slice(0, 40);
  }, [q, docs, wsDocs, wsHits, bundle.notes]);

  function openHit(h: Hit) {
    setQ("");
    if (h.kind === "doc") onOpenDoc(h.doc);
    else if (h.kind === "workspace") router.push(`/dashboard/workspace/${h.id}`);
    else onOpenNotes();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      {/* Stat cards — single slidable row on mobile */}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden [&>*]:min-w-[42%] [&>*]:shrink-0 sm:[&>*]:min-w-0">
        {stats.map((s) => (
          <div key={s.key} className="snap-start rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Unified search across every document type */}
      <div className="relative mt-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all documents — contracts, SOWs, notes, workspace…"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-accent"
        />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        {q.trim() && (
          <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</div>
            ) : results.map((h) => (
              <button key={`${h.kind}-${h.id}`} type="button" onClick={() => openHit(h)} className="flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-muted/40">
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md", h.kind === "note" ? "bg-amber-500/10 text-amber-600" : h.kind === "workspace" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
                  {h.kind === "note" ? <StickyNote className="h-4 w-4" /> : h.kind === "workspace" ? <LayoutDashboard className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Full Workspace home: My Documents / Shared / Favorites / Templates / Archived,
          with List / Cards / Table / Kanban / Calendar views, folders + space switcher. */}
      <div className="mt-6">
        <WorkspaceHome
          mine={bundle.mine}
          shared={bundle.shared}
          folders={bundle.folders}
          templates={bundle.templates}
          hiddenTemplateIds={bundle.hiddenTemplateIds}
          favoriteTemplateIds={bundle.favoriteTemplateIds}
          archived={bundle.archived}
          workspaces={bundle.workspaces}
          currentWorkspaceId={bundle.currentWorkspaceId}
        />
      </div>
    </div>
  );
}
