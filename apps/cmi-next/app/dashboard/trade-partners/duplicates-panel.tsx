"use client";

// Likely duplicate companies, side by side, with "keep this one" merge buttons.
// Merging moves contacts, deals, documents, applications, interviews and MSA
// signatures to the kept company and archives the other (lib/companies/merge.ts).
import * as React from "react";
import { GitMerge, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-action";

type Lite = { id: string; name: string; created_at?: string | null };
type Pair = { a: Lite; b: Lite; score: number; exact: boolean };

export function DuplicatesPanel({ onClose, onMerged }: { onClose: () => void; onMerged: () => void }) {
  const [pairs, setPairs] = React.useState<Pair[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [skipped, setSkipped] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    const res = await fetch("/api/trade-partners/duplicates");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json.error ?? "Couldn't load duplicates."); setPairs([]); return; }
    setPairs(json.pairs ?? []);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function merge(keep: Lite, drop: Lite) {
    if (!(await confirmAction({
      title: `Keep "${keep.name}" and merge "${drop.name}" into it?`, tone: "archive",
      body: `Contacts, deals, documents, applications and interviews move to ${keep.name}. Empty details are filled in from ${drop.name}, which is then archived (not deleted).`,
      confirmLabel: "Merge",
    }))) return;
    setBusy(`${keep.id}:${drop.id}`); setMessage(null);
    const res = await fetch("/api/trade-partners/duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ survivor_id: keep.id, duplicate_id: drop.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMessage(json.error ?? "Merge failed."); return; }
    const moved = Object.entries(json.moved ?? {}).filter(([, n]) => Number(n) > 0).map(([t, n]) => `${n} ${t.replace(/_/g, " ")}`).join(", ");
    setMessage(`Merged ${drop.name} into ${keep.name}${moved ? ` (moved ${moved})` : ""}.`);
    onMerged();
    await load();
  }

  const visible = pairs?.filter((p) => !skipped.has(`${p.a.id}:${p.b.id}`)) ?? [];
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><GitMerge className="h-4 w-4 text-accent" /> Possible duplicates</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Pick the record to keep. Not the same company? Skip it.</p>
      {message && <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs">{message}</p>}
      {!pairs ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Comparing names…</p>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No likely duplicates.</p>
      ) : (
        <ul className="mt-3 max-h-[420px] divide-y divide-border overflow-y-auto rounded-md border border-border">
          {visible.map((p) => {
            const key = `${p.a.id}:${p.b.id}`;
            return (
              <li key={key} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">{p.exact ? "Exact" : `${Math.round(p.score * 100)}%`}</span>
                <span className="min-w-0 flex-1 truncate">{p.a.name} <span className="text-muted-foreground">↔</span> {p.b.name}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void merge(p.a, p.b)} title={`Keep ${p.a.name}`}>Keep first</Button>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void merge(p.b, p.a)} title={`Keep ${p.b.name}`}>Keep second</Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setSkipped((s) => new Set(s).add(key))}>Skip</Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
