"use client";

import * as React from "react";
import { ArrowLeft, Check, Loader2, Printer } from "lucide-react";
import type { EmailBlock } from "@/components/email-builder/types";
import { VisualEditor } from "@/components/email-builder/visual-editor";
import { PAGE_SIZES, pageDims, type PageSizeKey, type Orientation } from "./page-sizes";
import { printableHtml, openPrintWindow } from "./print-doc";
import type { PrintDoc } from "./types";

interface Props {
  print: PrintDoc | null;
  onSave: (saved: PrintDoc) => void;
  onBack: () => void;
}

export function PrintEditor({ print, onSave, onBack }: Props) {
  const isNew = !print?.id;
  const [name, setName] = React.useState(print?.name ?? "");
  const [pageSize, setPageSize] = React.useState<PageSizeKey>(print?.page_size ?? "letter");
  const [orientation, setOrientation] = React.useState<Orientation>(print?.orientation ?? "portrait");
  const [widthIn, setWidthIn] = React.useState<number | null>(print?.width_in ?? null);
  const [heightIn, setHeightIn] = React.useState<number | null>(print?.height_in ?? null);
  const [status, setStatus] = React.useState<"draft" | "active">(print?.status ?? "draft");
  const [blocks, setBlocks] = React.useState<EmailBlock[]>(print?.blocks ?? []);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  const dims = pageDims(pageSize, orientation, widthIn, heightIn);
  const canvasWidth = Math.min(dims.wPx, 1100);

  async function save(): Promise<PrintDoc | null> {
    if (!name.trim()) { setError("Give the print a name."); return null; }
    setSaving(true); setError("");
    const payload = {
      name: name.trim(), page_size: pageSize, orientation, width_in: widthIn, height_in: heightIn,
      blocks, html: printableHtml(blocks, { pageSize, orientation, widthIn, heightIn }), status,
    };
    try {
      const url = isNew ? "/api/prints" : `/api/prints/${print!.id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json() as { print?: PrintDoc; message?: string };
      if (!res.ok || !data.print) throw new Error(data.message ?? "Save failed.");
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave(data.print);
      return data.print;
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); return null; }
    finally { setSaving(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button type="button" onClick={onBack} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <input className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none focus:border-accent" placeholder="Print name…" value={name} onChange={(e) => setName(e.target.value)} />

        <select className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent" value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSizeKey)}>
          {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="custom">Custom…</option>
        </select>
        {pageSize === "custom" ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="number" step="0.1" min={1} placeholder="W in" value={widthIn ?? ""} onChange={(e) => setWidthIn(e.target.value ? Number(e.target.value) : null)} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-accent" />×
            <input type="number" step="0.1" min={1} placeholder="H in" value={heightIn ?? ""} onChange={(e) => setHeightIn(e.target.value ? Number(e.target.value) : null)} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-accent" />in
          </span>
        ) : null}

        <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
          {(["portrait", "landscape"] as Orientation[]).map((o) => (
            <button key={o} type="button" onClick={() => setOrientation(o)} className={`rounded px-2.5 py-1.5 font-medium capitalize transition ${orientation === o ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`}>{o}</button>
          ))}
        </div>

        <select className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")}>
          <option value="draft">Draft</option><option value="active">Active</option>
        </select>

        <button type="button" onClick={() => openPrintWindow(printableHtml(blocks, { pageSize, orientation, widthIn, heightIn }))} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"><Printer className="h-3.5 w-3.5" /> Print / PDF</button>

        {error && <span className="text-xs text-destructive">{error}</span>}

        <button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <VisualEditor blocks={blocks} onChange={setBlocks} pageWidth={canvasWidth} />
      </div>
    </div>
  );
}
