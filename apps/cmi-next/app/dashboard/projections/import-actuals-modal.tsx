"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import type { ImportPreviewRow } from "@/lib/projections/data";

type Field = "customer" | "job" | "date" | "amount" | "ref" | "memo";
const FIELDS: { key: Field; label: string; required?: boolean; guess: RegExp }[] = [
  { key: "customer", label: "Customer", guess: /^(customer|customer.?name|name|client)$/i },
  { key: "job", label: "Job / Project", guess: /job|project|class/i },
  { key: "date", label: "Date", required: true, guess: /date/i },
  { key: "amount", label: "Amount", required: true, guess: /^(amount|total|invoice.?amount|billed|amount.?billed)$/i },
  { key: "ref", label: "Reference #", guess: /^(num|no\.?|ref|reference|invoice.?(no|#|number)|doc.?(no|number))$/i },
  { key: "memo", label: "Memo", guess: /memo|description|note/i },
];

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

// "2026-09-15", "9/15/2026", "09-15-26" → "2026-09-15"; anything else → "".
function toIsoDate(v: string): string {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  return "";
}

// "$1,234.50", "(500.00)" → 1234.5, -500
function toAmount(v: string): number {
  const s = v.trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[()$,\s-]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

export function ImportActualsModal({ projections, onClose, onImported }: {
  projections: { id: string; name: string }[];
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<string[][] | null>(null);
  const [map, setMap] = React.useState<Record<Field, number>>({ customer: -1, job: -1, date: -1, amount: -1, ref: -1, memo: -1 });
  const [preview, setPreview] = React.useState<ImportPreviewRow[] | null>(null);
  const [assign, setAssign] = React.useState<Record<number, string>>({});
  const [switchSource, setSwitchSource] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const headers = table?.[0] ?? [];

  async function onFile(file: File) {
    setError(null); setPreview(null); setAssign({});
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setError("That file has no data rows."); return; }
    setFileName(file.name);
    setTable(rows);
    const next = { customer: -1, job: -1, date: -1, amount: -1, ref: -1, memo: -1 } as Record<Field, number>;
    for (const f of FIELDS) next[f.key] = rows[0].findIndex((h) => f.guess.test(h.trim()));
    setMap(next);
  }

  async function runPreview() {
    if (!table) return;
    if (map.date < 0 || map.amount < 0) { setError("Choose the Date and Amount columns."); return; }
    if (map.customer < 0 && map.job < 0) { setError("Choose a Customer or Job column so rows can be matched."); return; }
    setBusy(true); setError(null);
    const col = (r: string[], k: Field) => (map[k] >= 0 ? (r[map[k]] ?? "").trim() : "");
    const rows = table.slice(1).map((r) => ({
      customer: col(r, "customer") || null, job: col(r, "job") || null,
      date: toIsoDate(col(r, "date")), amount: toAmount(col(r, "amount")),
      ref: col(r, "ref") || null, memo: col(r, "memo") || null,
    }));
    try {
      const res = await fetch("/api/projections/actuals/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not preview.");
      setPreview(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const target = (r: ImportPreviewRow) => assign[r.index] || r.projection_id || "";
  const ready = (preview ?? []).filter((r) => !r.error && !r.duplicate && target(r));
  const unmatched = (preview ?? []).filter((r) => !r.error && !r.duplicate && !target(r));
  const readyTotal = ready.reduce((s, r) => s + r.amount, 0);
  const willSwitch = new Set(ready.filter((r) => (r.projection_id === target(r) ? r.actuals_source : null) === "cmi_invoices").map(target)).size;

  async function runImport() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/projections/actuals/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          switch_source: switchSource,
          rows: ready.map((r) => ({ projection_id: target(r), date: r.date, amount: r.amount, external_ref: r.external_ref, note: r.memo || r.ref || null })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed.");
      onImported(`Imported ${json.imported} billing row${json.imported === 1 ? "" : "s"}${json.skipped ? `, skipped ${json.skipped} already imported` : ""}${json.switched ? `; ${json.switched} project${json.switched === 1 ? "" : "s"} switched to external billing` : ""}.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="import-title" className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="import-title" className="font-semibold">Import Billing Actuals</h2>
            <p className="text-xs text-muted-foreground">CSV export from Adaptive or QuickBooks. Rows match by accounting customer ID, then job number, then job name.</p>
          </div>
          <button type="button" aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-4 py-4 text-sm hover:bg-muted/40">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span>{fileName ? <>File: <span className="font-medium">{fileName}</span> ({(table?.length ?? 1) - 1} rows) — choose another</> : "Choose a CSV file"}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          </label>

          {table && !preview && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Match columns</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block space-y-1 text-xs">
                    <span className="font-medium">{f.label}{f.required ? " *" : ""}</span>
                    <select value={map[f.key]} onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent">
                      <option value={-1}>— none —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex justify-end"><Button size="sm" variant="accent" disabled={busy} onClick={() => void runPreview()}>{busy ? "Matching…" : "Preview matches"}</Button></div>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="success">{ready.length} ready · {formatMoney(readyTotal)}</Badge>
                {unmatched.length > 0 && <Badge tone="warning">{unmatched.length} unmatched</Badge>}
                {preview.some((r) => r.duplicate) && <Badge>{preview.filter((r) => r.duplicate).length} already imported</Badge>}
                {preview.some((r) => r.error) && <Badge tone="danger">{preview.filter((r) => r.error).length} invalid</Badge>}
                <button type="button" className="ml-auto text-accent hover:underline" onClick={() => setPreview(null)}>← Change columns</button>
              </div>
              <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Customer / Job</th>
                      <th className="px-2 py-1.5 font-medium">Date</th>
                      <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-2 py-1.5 font-medium">Projection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((r) => (
                      <tr key={r.index} className={cn((r.error || r.duplicate) && "text-muted-foreground")}>
                        <td className="px-2 py-1.5">{[r.customer, r.job].filter(Boolean).join(" · ") || "—"}{r.ref ? <span className="text-muted-foreground"> #{r.ref}</span> : null}</td>
                        <td className="px-2 py-1.5">{r.date || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{Number.isFinite(r.amount) ? formatMoney(r.amount) : "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.error ? <span className="text-destructive">{r.error}</span>
                            : r.duplicate ? "Already imported — skipped"
                            : r.projection_id ? <span>{r.projection_name} <span className="text-muted-foreground">({r.matched_by === "accounting_customer_id" ? "customer ID" : r.matched_by === "job_number" ? "job #" : "name"})</span></span>
                            : (
                              <select value={assign[r.index] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [r.index]: e.target.value }))}
                                className="h-7 w-full rounded border border-warning bg-background px-1.5 text-xs outline-none">
                                <option value="">Unmatched — skip, or pick…</option>
                                {projections.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <input type="checkbox" className="mt-0.5" checked={switchSource} onChange={(e) => setSwitchSource(e.target.checked)} />
                <span>
                  Switch matched projects to external billing{willSwitch ? ` (${willSwitch} currently read CMI invoices)` : ""}.
                  <span className="block text-muted-foreground">Each project reads billing from one source so nothing is counted twice. Leave unticked only if these projects already use external billing.</span>
                </span>
              </label>
            </div>
          )}
        </div>
        {preview && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="accent" disabled={busy || ready.length === 0} onClick={() => void runImport()}>{busy ? "Importing…" : `Import ${ready.length} row${ready.length === 1 ? "" : "s"}`}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
