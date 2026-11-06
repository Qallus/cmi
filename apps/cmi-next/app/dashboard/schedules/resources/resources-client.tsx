"use client";

// Resources across every job (Schedules Phase 2 Step 7): one row per person,
// trade partner or trade, weeks across. Each cell counts the open tasks that
// week; red means two of them fall on the same day (an overlap). Click a cell
// for the tasks. A trade without a partner ("Electrician") can be converted to
// a trade partner in one click. No levelling: dates aren't moved for you.
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RESOURCE_ICON } from "@/components/schedules/resource-picker";
import type { LoadRow } from "@/lib/schedules/resources";

type TaskLite = { id: string; title: string; job_id: string | null; job_label: string | null; schedule_id: string; start_date: string | null; end_date: string | null };
type Data = { from: string; weeks: number; rows: LoadRow[]; tasks: Record<string, TaskLite> };
type Partner = { id: string; name: string; sub?: string | null };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const short = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");
const TYPE_LABEL: Record<string, string> = { staff: "Staff", vendor: "Trade partner", contractor: "Contractor", client: "Client", trade: "Trade" };

export function ResourcesClient({ canEdit }: { canEdit: boolean }) {
  const [from, setFrom] = React.useState(today);
  const [weeks, setWeeks] = React.useState(8);
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cell, setCell] = React.useState<{ row: string; week: string } | null>(null);
  const [filter, setFilter] = React.useState<"all" | "staff" | "partners" | "trades" | "overlaps">("all");
  const [converting, setConverting] = React.useState<LoadRow | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedules/resources?from=${from}&weeks=${weeks}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (r.ok) { setData(j); setError(null); } else setError(j.error ?? "Couldn't load resources.");
    }).catch(() => { if (live) setError("Couldn't load resources."); });
    return () => { live = false; };
  }, [from, weeks, version]);

  const rows = (data?.rows ?? []).filter((r) => filter === "all" ? true : filter === "staff" ? r.resource.type === "staff" : filter === "partners" ? r.resource.type === "vendor" || r.resource.type === "contractor" : filter === "trades" ? r.resource.type === "trade" : r.overlaps > 0);
  const openRow = cell ? data?.rows.find((r) => r.key === cell.row) : null;
  const openCell = openRow?.cells.find((c) => c.week === cell?.week);
  const overlapCount = (data?.rows ?? []).filter((r) => r.overlaps).length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard/schedules" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Schedules</Link>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="text-sm text-muted-foreground">Who&apos;s busy when, across every job. Red weeks have two tasks on the same day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setFrom((f) => addDays(f, -7 * Math.max(1, Math.floor(weeks / 2))))} aria-label="Earlier"><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => setFrom(today())}>This week</Button>
          <Button size="sm" variant="outline" onClick={() => setFrom((f) => addDays(f, 7 * Math.max(1, Math.floor(weeks / 2))))} aria-label="Later"><ChevronRight className="h-3.5 w-3.5" /></Button>
          <select aria-label="Weeks shown" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-8 rounded-md border border-border bg-card px-2 text-xs">
            {[4, 8, 12, 26].map((w) => <option key={w} value={w}>{w} weeks</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {([["all", "All"], ["staff", "Staff"], ["partners", "Trade partners"], ["trades", "Trades without a partner"], ["overlaps", `Overlaps${overlapCount ? ` (${overlapCount})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === k ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted")}>{l}</button>
        ))}
      </div>

      {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      {!data && !error ? <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : null}
      {data && !rows.length ? <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No one has open tasks in these weeks{filter !== "all" ? " for this filter" : ""}. Assign people, trade partners or trades on a schedule (task → Assignees, or right-click rows → Assign…).</div> : null}

      {data && rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold">Resource</th>
                {data.rows[0]?.cells.map((c) => <th key={c.week} className="px-1 py-2 text-center font-semibold">{short(c.week)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => { const Icon = RESOURCE_ICON[(r.resource.type ?? "staff") as keyof typeof RESOURCE_ICON] ?? RESOURCE_ICON.staff; return (
                <tr key={r.key} className="border-b border-border/60">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                    <div className="flex items-center gap-1.5 font-medium"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{r.resource.name}{r.overlaps ? <AlertTriangle className="h-3 w-3 text-destructive" /> : null}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{TYPE_LABEL[r.resource.type ?? "staff"]} · {r.tasks} task{r.tasks === 1 ? "" : "s"} · {r.jobs} job{r.jobs === 1 ? "" : "s"}</span>
                      {r.resource.type === "trade" && canEdit ? <button type="button" onClick={() => setConverting(r)} className="font-medium text-accent hover:underline">Pick trade partner</button> : null}
                    </div>
                  </td>
                  {r.cells.map((c) => {
                    const n = c.taskIds.length;
                    const on = cell?.row === r.key && cell.week === c.week;
                    return (
                      <td key={c.week} className="px-0.5 py-1 text-center">
                        {n ? (
                          <button type="button" onClick={() => setCell(on ? null : { row: r.key, week: c.week })}
                            className={cn("h-7 w-full min-w-[2.25rem] rounded font-semibold tabular-nums transition",
                              c.overlap ? "bg-destructive/15 text-destructive hover:bg-destructive/25" : "bg-accent/15 text-accent hover:bg-accent/25", on && "ring-2 ring-accent")}>
                            {n}
                          </button>
                        ) : <span className="block h-7" />}
                      </td>
                    );
                  })}
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ) : null}

      {openRow && openCell ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-medium">{openRow.resource.name} · week of {short(openCell.week)}{openCell.overlap ? <span className="ml-2 text-xs font-medium text-destructive">Two or more on the same day</span> : null}</div>
          <ul className="divide-y divide-border text-sm">
            {openCell.taskIds.map((id) => { const t = data!.tasks[id]; if (!t) return null; return (
              <li key={id}>
                <Link href={t.job_id ? `/dashboard/jobs/${t.job_id}/schedule?schedule=${t.schedule_id}` : "/dashboard/schedules"} className="flex flex-wrap items-center justify-between gap-2 py-1.5 hover:text-accent">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.job_label ?? "—"} · {short(t.start_date)} – {short(t.end_date)}</span>
                </Link>
              </li>
            ); })}
          </ul>
        </div>
      ) : null}

      {converting ? <ConvertDialog row={converting} onClose={() => setConverting(null)} onDone={() => { setConverting(null); setVersion((v) => v + 1); }} /> : null}
    </div>
  );
}

// Swap "Electrician" for a real trade partner on every task that has it.
function ConvertDialog({ row, onClose, onDone }: { row: LoadRow; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = React.useState("");
  const [list, setList] = React.useState<Partner[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/schedules/resources?pool=1&q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d: { pool?: (Partner & { type?: string })[] }) => {
        if (live) setList((d.pool ?? []).filter((p) => p.type === "vendor"));
      }).catch(() => {});
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  async function pick(p: Partner) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/schedules/resources/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelId: row.resource.id, companyId: p.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't convert it.");
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label="Pick trade partner" className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="font-display text-lg font-semibold">Who is the {row.resource.name}?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every task assigned to &quot;{row.resource.name}&quot; ({row.tasks} in view) switches to the trade partner you pick.</p>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trade partners" className="mt-3 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
        <ul className="mt-2 max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {q.trim().length < 2 ? <li className="px-3 py-2 text-xs text-muted-foreground">Type at least two letters.</li> : !list.length ? <li className="px-3 py-2 text-xs text-muted-foreground">No trade partners match.</li> : list.map((p) => (
            <li key={p.id}><button type="button" disabled={busy} onClick={() => void pick(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><span className="font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.sub}</span></button></li>
          ))}
        </ul>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <div className="mt-3 flex justify-end"><Button size="sm" variant="outline" onClick={onClose}>Cancel</Button></div>
      </div>
    </div>
  );
}
