"use client";

// Import dialog shared by Pre-Con and Jobs. CSV files are matched to fields by
// their column headers; .txt / .md files are read by Bolt, which also suggests
// whether each project belongs in Pre-Con or Jobs. Everything lands in a
// preview first — nothing is saved until "Import" is clicked.
import * as React from "react";
import { Download, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseDelimited } from "@/lib/csv";
import {
  coerceRecord, matchHeaders, translateFields, NAME_KEY, TARGET_LABEL, type RecordTarget,
} from "@/lib/records-io/fields";
import { downloadTemplate } from "@/lib/records-io/export";

type PreviewRow = {
  id: number;
  include: boolean;
  target: RecordTarget;
  fields: Record<string, unknown>;
  source: string;
  reason?: string;
  bolt: boolean;
};
type RowResult = { name: string; status: "imported" | "skipped" | "error"; message?: string };

const ENDPOINT: Record<RecordTarget, string> = { precon: "/api/pipeline/import", jobs: "/api/jobs/import" };
let nextId = 1;

const pick = (f: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (f[k] != null && f[k] !== "") return String(f[k]);
  return "";
};
const moneyText = (v: string) => (v && !Number.isNaN(Number(v)) ? `$${Number(v).toLocaleString()}` : v);

export function RecordsImportModal({
  defaultTarget, onClose, onImported,
}: {
  defaultTarget: RecordTarget;
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = React.useState<PreviewRow[]>([]);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [reading, setReading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = React.useState<"skip" | "create">("skip");
  const [results, setResults] = React.useState<{ target: RecordTarget; results: RowResult[] }[] | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const csvRows: PreviewRow[] = [];
    const newNotes: string[] = [];
    const textFiles: { name: string; text: string }[] = [];

    for (const file of Array.from(list)) {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "csv" || ext === "tsv") {
        const grid = parseDelimited(text, ext === "tsv" ? "\t" : ",");
        if (grid.length < 2) { newNotes.push(`${file.name}: no data rows.`); continue; }
        const { keys, unmatched } = matchHeaders(grid[0].map((h) => h.replace(/^﻿/, "")), defaultTarget);
        if (unmatched.length) newNotes.push(`${file.name}: ignored column${unmatched.length > 1 ? "s" : ""} ${unmatched.map((u) => `“${u}”`).join(", ")}`);
        for (const line of grid.slice(1)) {
          const raw: Record<string, unknown> = {};
          keys.forEach((k, i) => { if (k) raw[k] = line[i]; });
          csvRows.push({ id: nextId++, include: true, target: defaultTarget, fields: raw, source: file.name, bolt: false });
        }
      } else {
        textFiles.push({ name: file.name, text });
      }
    }

    let boltRows: PreviewRow[] = [];
    if (textFiles.length) {
      setReading(true);
      try {
        const res = await fetch("/api/records/extract", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: textFiles }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        boltRows = (json.records as { source: string; destination: RecordTarget; reason: string; fields: Record<string, unknown> }[])
          .map((r) => ({ id: nextId++, include: true, target: r.destination, fields: r.fields, source: r.source, reason: r.reason, bolt: true }));
        newNotes.push(...(json.errors as string[]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bolt couldn't read those files.");
      } finally {
        setReading(false);
      }
    }
    setRows((prev) => [...prev, ...csvRows, ...boltRows]);
    setNotes((prev) => [...prev, ...newNotes]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function update(id: number, patch: (r: PreviewRow) => PreviewRow) {
    setRows((prev) => prev.map((r) => (r.id === id ? patch(r) : r)));
  }
  function moveTo(id: number, target: RecordTarget) {
    update(id, (r) => ({ ...r, target, fields: translateFields(r.fields, r.target, target) }));
  }

  const included = rows.filter((r) => r.include);
  const allIncluded = rows.length > 0 && included.length === rows.length;

  async function runImport() {
    setImporting(true); setError(null);
    const out: { target: RecordTarget; results: RowResult[] }[] = [];
    try {
      for (const target of ["precon", "jobs"] as RecordTarget[]) {
        const batch = included.filter((r) => r.target === target).map((r) => r.fields);
        if (!batch.length) continue;
        const res = await fetch(ENDPOINT[target], {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: batch, duplicateAction }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`${TARGET_LABEL[target]}: ${json.error ?? `HTTP ${res.status}`}`);
        out.push({ target, results: json.results });
      }
      setResults(out);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      if (out.length) { setResults(out); onImported(); }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-lg font-semibold">Import {defaultTarget === "precon" ? "Pre-Con" : "Jobs"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          {results ? (
            <ResultsView results={results} />
          ) : (
            <>
              <div className="rounded-lg border border-dashed border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="accent" onClick={() => fileRef.current?.click()} disabled={reading}>
                    <Upload className="h-3.5 w-3.5" /> Choose files
                  </Button>
                  <input ref={fileRef} type="file" multiple accept=".csv,.tsv,.txt,.md" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
                  <span className="text-xs text-muted-foreground">
                    <strong>.csv</strong> — columns are matched by header. <strong>.txt / .md</strong> — Bolt reads each file and suggests Pre-Con or Jobs.
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <button type="button" className="flex items-center gap-1 text-accent hover:underline" onClick={() => downloadTemplate("precon")}><Download className="h-3 w-3" /> Pre-Con CSV template</button>
                  <button type="button" className="flex items-center gap-1 text-accent hover:underline" onClick={() => downloadTemplate("jobs")}><Download className="h-3 w-3" /> Jobs CSV template</button>
                </div>
                {reading && <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Bolt is reading your files…</div>}
              </div>

              {notes.length > 0 && (
                <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="w-8 px-3 py-2"><input type="checkbox" checked={allIncluded} onChange={(e) => setRows((p) => p.map((r) => ({ ...r, include: e.target.checked })))} /></th>
                        <th className="px-3 py-2">Import into</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Address</th>
                        <th className="px-3 py-2">Client</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">Stage / Status</th>
                        <th className="px-3 py-2">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => {
                        const { fields, warnings } = coerceRecord(r.fields, r.target);
                        const nameKey = NAME_KEY[r.target];
                        return (
                          <tr key={r.id} className={cn(!r.include && "opacity-50")}>
                            <td className="px-3 py-2 align-top"><input type="checkbox" checked={r.include} onChange={(e) => update(r.id, (x) => ({ ...x, include: e.target.checked }))} /></td>
                            <td className="px-3 py-2 align-top">
                              <select value={r.target} onChange={(e) => moveTo(r.id, e.target.value as RecordTarget)} className="h-7 rounded border border-border bg-background px-1.5 text-xs">
                                <option value="precon">Pre-Con</option>
                                <option value="jobs">Jobs</option>
                              </select>
                              {r.bolt && (
                                <div className="mt-1 flex max-w-[180px] items-start gap-1 text-[10px] leading-tight text-muted-foreground" title={r.reason}>
                                  <Sparkles className="mt-px h-2.5 w-2.5 shrink-0 text-accent" /> {r.reason || "Suggested by Bolt"}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input value={String(r.fields[nameKey] ?? "")} onChange={(e) => update(r.id, (x) => ({ ...x, fields: { ...x.fields, [nameKey]: e.target.value } }))}
                                className="h-7 w-full min-w-[160px] rounded border border-border bg-background px-2 text-sm" />
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><FileText className="h-2.5 w-2.5" /> {r.source}</div>
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-muted-foreground">{[pick(fields, "project_address", "street_address"), pick(fields, "city"), pick(fields, "state"), pick(fields, "zip_code")].filter(Boolean).join(", ") || "—"}</td>
                            <td className="px-3 py-2 align-top text-xs text-muted-foreground">{pick(fields, "client_name", "client_email") || "—"}</td>
                            <td className="px-3 py-2 align-top text-xs text-muted-foreground">{moneyText(pick(fields, "contract_price", "contract_value", "estimated_project_value")) || "—"}</td>
                            <td className="px-3 py-2 align-top text-xs text-muted-foreground">{pick(fields, "stage", "status").replace(/_/g, " ") || "—"}</td>
                            <td className="px-3 py-2 align-top text-xs">
                              {warnings.length === 0
                                ? <span className="text-success">Ready</span>
                                : <ul className="space-y-0.5 text-warning">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          {results ? <span /> : (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              If the name already exists:
              <select value={duplicateAction} onChange={(e) => setDuplicateAction(e.target.value as "skip" | "create")} className="h-7 rounded border border-border bg-background px-1.5 text-xs">
                <option value="skip">Skip it</option>
                <option value="create">Create another</option>
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>{results ? "Done" : "Cancel"}</Button>
            {!results && (
              <Button size="sm" variant="accent" onClick={() => void runImport()} disabled={importing || reading || included.length === 0}>
                {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</> : `Import ${included.length} record${included.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsView({ results }: { results: { target: RecordTarget; results: RowResult[] }[] }) {
  return (
    <div className="space-y-4">
      {results.map(({ target, results: rs }) => {
        const count = (s: RowResult["status"]) => rs.filter((r) => r.status === s).length;
        return (
          <div key={target} className="rounded-lg border border-border p-4">
            <div className="text-sm font-semibold">{target === "precon" ? "Pre-Con" : "Jobs"}: {count("imported")} imported · {count("skipped")} skipped · {count("error")} failed</div>
            <ul className="mt-2 space-y-1 text-xs">
              {rs.filter((r) => r.status !== "imported" || r.message).map((r, i) => (
                <li key={i} className={r.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                  <strong>{r.name}</strong> — {r.status}{r.message ? `: ${r.message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
