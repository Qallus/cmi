"use client";

import * as React from "react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Reconcile, PermitLine } from "@/lib/inspections/permit";
import type { PermitState, PermitResult } from "@/lib/inspections/permit-data";

const sel = "h-8 w-full rounded-md border border-border bg-card px-2 text-xs";
const lineLabel = (l: PermitLine) => `${l.code ? `${l.code} · ` : ""}${l.name}`;

// Inspection milestones, Step 5: the permit list wins. Paste the inspection list
// printed on the permit; matched milestones take its names and codes, ones the
// permit doesn't list become N/A, and ones only on the permit are added.
export function PermitDialog({ scheduleId, scheduleName, onClose, onApplied }: {
  scheduleId: string; scheduleName: string; onClose: () => void; onApplied: (r: PermitResult) => void;
}) {
  const [state, setState] = React.useState<PermitState | null>(null);
  const [text, setText] = React.useState("");
  const [rec, setRec] = React.useState<Reconcile | null>(null);
  const [rename, setRename] = React.useState<Record<number, boolean>>({});
  // Permit-only line → "add" | "skip" | an item id it's the same as.
  const [choice, setChoice] = React.useState<Record<number, string>>({});
  const [after, setAfter] = React.useState<Record<number, string>>({});
  const [na, setNa] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<PermitResult | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedules/${scheduleId}/inspections/permit`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!live) return;
      if (!res.ok) { setError(d.error ?? "Couldn't load the permit list."); return; }
      setState(d); setText(d.text ?? "");
    });
    return () => { live = false; };
  }, [scheduleId]);

  async function compare() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/inspections/permit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, preview: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't compare the list."); return; }
      const r = d as Reconcile;
      setRec(r);
      setRename(Object.fromEntries(r.matched.map((m) => [m.line.n, true])));
      setChoice(Object.fromEntries(r.permitOnly.map((l) => [l.n, "add"])));
      setAfter({});
      setNa(Object.fromEntries(r.scheduleOnly.map((i) => [i.id, true])));
    } finally { setBusy(false); }
  }

  // Schedule-only items the PM matched to a permit line by hand.
  const claimed = new Set(Object.values(choice).filter((v) => v !== "add" && v !== "skip"));

  async function apply() {
    if (!rec) return;
    setBusy(true); setError(null);
    try {
      const matches = [
        ...rec.matched.filter((m) => rename[m.line.n]).map((m) => ({ line: m.line.n, item_ids: m.items.map((i) => i.id) })),
        ...rec.permitOnly.filter((l) => claimed.has(choice[l.n])).map((l) => ({ line: l.n, item_ids: [choice[l.n]] })),
      ];
      const adds = rec.permitOnly.filter((l) => choice[l.n] === "add").map((l) => ({ line: l.n, after_item_id: after[l.n] || null }));
      const naIds = rec.scheduleOnly.filter((i) => na[i.id] && !claimed.has(i.id)).map((i) => i.id);
      const res = await fetch(`/api/schedules/${scheduleId}/inspections/permit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, matches, na: naIds, adds }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't apply the permit list."); return; }
      setResult(d); onApplied(d);
    } finally { setBusy(false); }
  }

  const footer = result ? <div className="flex justify-end"><Button size="sm" variant="accent" onClick={onClose}>Done</Button></div>
    : rec ? (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setRec(null)}>Back to the list</Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" disabled={busy} onClick={() => void apply()}>{busy ? "Applying…" : "Apply the permit list"}</Button>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" disabled={busy || !text.trim() || !state?.inspections} onClick={() => void compare()}>{busy ? "Comparing…" : "Compare"}</Button>
      </div>
    );

  return (
    <ScheduleModal open onClose={onClose} title={`Permit inspection list: ${scheduleName}`} footer={footer}>
      <div className="space-y-3 pb-4 text-sm">
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</div> : null}

        {result ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            Permit list applied and marked verified {result.verified_on}: {result.renamed} renamed to the permit&apos;s names and codes, {result.marked_na} marked N/A, {result.added} added{result.added ? ` (${result.linked} linked)` : ""}.
          </div>
        ) : rec ? (
          <>
            <Section title={`Matched (${rec.matched.length})`} hint="These take the permit's name and inspection number.">
              {rec.matched.map((m) => (
                <Row key={m.line.n}>
                  <input type="checkbox" checked={!!rename[m.line.n]} onChange={(e) => setRename((r) => ({ ...r, [m.line.n]: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`Rename to ${lineLabel(m.line)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{lineLabel(m.line)}</div>
                    <div className="text-xs text-muted-foreground">{m.items.map((i) => i.title).join(", ")} · by {m.by}</div>
                  </div>
                </Row>
              ))}
            </Section>

            <Section title={`Only on the permit (${rec.permitOnly.length})`} hint="Add each as a new inspection after a task, or match it to one already on the schedule.">
              {rec.permitOnly.map((l) => (
                <Row key={l.n}>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-medium">{lineLabel(l)}</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <select className={sel} value={choice[l.n] ?? "add"} onChange={(e) => setChoice((c) => ({ ...c, [l.n]: e.target.value }))} aria-label={`What to do with ${l.name}`}>
                        <option value="add">Add as a new inspection</option>
                        {rec.scheduleOnly.filter((i) => !claimed.has(i.id) || choice[l.n] === i.id).map((i) => <option key={i.id} value={i.id}>Same as {i.title}</option>)}
                        <option value="skip">Skip</option>
                      </select>
                      {choice[l.n] === "add" ? (
                        <select className={sel} value={after[l.n] ?? ""} onChange={(e) => setAfter((a) => ({ ...a, [l.n]: e.target.value }))} aria-label={`Add ${l.name} after`}>
                          <option value="">After… (or on today&apos;s date)</option>
                          {state?.tasks.map((t) => <option key={t.id} value={t.id}>After {t.title}</option>)}
                        </select>
                      ) : null}
                    </div>
                  </div>
                </Row>
              ))}
            </Section>

            <Section title={`Only on the schedule (${rec.scheduleOnly.length})`} hint="The permit doesn't list these. N/A keeps them on record, out of the way.">
              {rec.scheduleOnly.map((i) => (
                <Row key={i.id}>
                  {claimed.has(i.id) ? <span className="mt-0.5 h-4 w-4 shrink-0" /> : <input type="checkbox" checked={!!na[i.id]} onChange={(e) => setNa((n) => ({ ...n, [i.id]: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`Mark ${i.title} N/A`} />}
                  <div className={cn("min-w-0 flex-1", claimed.has(i.id) && "text-muted-foreground")}>
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground">{claimed.has(i.id) ? "Matched to a permit line above" : na[i.id] ? "Will be marked N/A" : "Stays as it is"}</div>
                  </div>
                </Row>
              ))}
            </Section>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Paste the inspection list printed on the permit, one per line (e.g. &quot;615 Footing&quot; or &quot;Footing (615)&quot;). The permit wins: matched inspections take its names and numbers, ones it doesn&apos;t list can be marked N/A, and ones only on the permit are added.
            </p>
            {state?.verified_on ? <div className="text-xs">Last checked against the permit on <strong>{state.verified_on}</strong>{state.verified_by ? ` by ${state.verified_by}` : ""}.</div> : null}
            {state && !state.inspections ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">Load this job&apos;s inspections first (Inspections button), then check them against the permit.</div> : null}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder={"615 Footing\n701 Stem Wall\n730 Underground Plumbing\n…"}
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs" aria-label="Permit inspection list" />
          </>
        )}
      </div>
    </ScheduleModal>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const empty = !React.Children.count(children);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mb-1 text-xs text-muted-foreground">{hint}</div>
      {empty ? <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">None.</div>
        : <div className="divide-y divide-border rounded-lg border border-border">{children}</div>}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 px-3 py-2">{children}</div>;
}
