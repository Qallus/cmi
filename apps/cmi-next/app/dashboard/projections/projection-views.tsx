"use client";

import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PinMap, type MapPin } from "@/components/ui/pin-map";
import { cn, formatMoney } from "@/lib/utils";
import { monthLabel } from "@/lib/projections/calc";
import { PROJECTION_STATUS_META, type ProjectionRow, type ProjectionStatus } from "@/lib/projections/types";
import { formatDate } from "../jobs/job-ui";

type ViewProps = { rows: ProjectionRow[]; onOpen: (id: string) => void; actions: (row: ProjectionRow) => React.ReactNode };

const sub = (r: ProjectionRow) =>
  r.source === "job" ? [r.job_number, r.client_name].filter(Boolean).join(" · ")
  : [`Anticipated${r.source === "deal" ? " · Deal" : r.source === "opportunity" ? " · Pre-Con" : ""}`, r.client_name].filter(Boolean).join(" · ");

function StatusBadge({ status }: { status: ProjectionStatus }) {
  const meta = PROJECTION_STATUS_META[status];
  return <Badge tone={meta.tone} className="h-5 shrink-0 px-1.5 text-[10px]">{meta.label}</Badge>;
}

function Warn({ row }: { row: ProjectionRow }) {
  if (!row.warnings.length && !row.new_actuals) return null;
  return (
    <span title={[...row.warnings, row.new_actuals ? "New billing to review" : ""].filter(Boolean).join(" · ")} className="shrink-0 text-yellow-700 dark:text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  );
}

// Rows and cards open on click anywhere; the name is the keyboard target
// (a real button), so the ⋯ menu isn't nested inside another button.
function NameButton({ row, onOpen, className }: { row: ProjectionRow; onOpen: (id: string) => void; className?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row.id); }}
      className={cn("truncate text-left hover:text-accent focus-visible:underline focus-visible:outline-none", className)}>{row.name}</button>
  );
}

// ── List ─────────────────────────────────────────────────────────────────

export function ListView({ rows, onOpen, actions }: ViewProps) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((r) => {
        const next = Object.entries(r.months)[0];
        return (
          <div key={r.id} onClick={() => onOpen(r.id)} className={cn("flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-muted/40", !r.include && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><NameButton row={r} onOpen={onOpen} className="font-medium" /><StatusBadge status={r.status} /><Warn row={r} /></div>
              <div className="truncate text-xs text-muted-foreground">{sub(r) || "—"}</div>
            </div>
            <div className="hidden w-44 shrink-0 text-xs text-muted-foreground md:block">{formatDate(r.forecast_start)} – {formatDate(r.forecast_finish)}</div>
            <div className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground lg:block">PM {r.pms.join(", ") || "—"}</div>
            <div className="w-28 shrink-0 text-right">
              <div className="text-sm font-medium tabular-nums">{formatMoney(r.remaining)}</div>
              <div className="text-[10px] text-muted-foreground">{next ? `${monthLabel(next[0])} ${formatMoney(next[1].projected, { compact: true })}` : ""}</div>
            </div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{actions(r)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

type Col = { key: string; label: string; value: (r: ProjectionRow) => string | number; render?: (r: ProjectionRow, onOpen: (id: string) => void) => React.ReactNode; right?: boolean };
const COLS: Col[] = [
  { key: "name", label: "Project", value: (r) => r.name.toLowerCase(), render: (r, onOpen) => <span className="flex items-center gap-1.5 font-medium"><NameButton row={r} onOpen={onOpen} /><Warn row={r} /></span> },
  { key: "status", label: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  { key: "client", label: "Client", value: (r) => (r.client_name ?? "").toLowerCase(), render: (r) => r.client_name ?? "—" },
  { key: "pm", label: "PM", value: (r) => r.pms.join(", ").toLowerCase(), render: (r) => r.pms.join(", ") || "—" },
  { key: "super", label: "Super", value: (r) => r.supers.join(", ").toLowerCase(), render: (r) => r.supers.join(", ") || "—" },
  { key: "start", label: "Start", value: (r) => r.forecast_start ?? "9999", render: (r) => formatDate(r.forecast_start) },
  { key: "finish", label: "Finish", value: (r) => r.forecast_finish ?? "9999", render: (r) => formatDate(r.forecast_finish) },
  { key: "total", label: "Total", value: (r) => r.total_revenue, render: (r) => formatMoney(r.total_revenue), right: true },
  { key: "billed", label: "Billed", value: (r) => r.billed_to_date, render: (r) => (r.has_actuals ? formatMoney(r.billed_to_date) : "—"), right: true },
  { key: "remaining", label: "Remaining", value: (r) => r.remaining, render: (r) => formatMoney(r.remaining), right: true },
  { key: "unallocated", label: "Unallocated", value: (r) => r.unallocated, render: (r) => (Math.abs(r.unallocated) <= 1 || r.remaining <= 0 ? "—" : formatMoney(r.unallocated)), right: true },
  { key: "window", label: "12-Mo", value: (r) => r.window_projected, render: (r) => formatMoney(r.window_projected, { compact: true }), right: true },
];

export function TableView({ rows, onOpen, actions }: ViewProps) {
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 }>({ key: "start", dir: 1 });
  const col = COLS.find((c) => c.key === sort.key) ?? COLS[0];
  const sorted = [...rows].sort((a, b) => { const x = col.value(a), y = col.value(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border">
            {COLS.map((c) => (
              <th key={c.key} className={cn("px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", c.right ? "text-right" : "text-left")}>
                <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-foreground">
                  {c.label}{sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} className={cn("cursor-pointer hover:bg-muted/40", !r.include && "opacity-60")}>
              {COLS.map((c) => <td key={c.key} className={cn("px-3 py-2 text-xs", c.right && "text-right tabular-nums")}>{c.render ? c.render(r, onOpen) : String(c.value(r))}</td>)}
              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────

export function CardView({ rows, onOpen, actions }: ViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {rows.map((r) => {
        const months = Object.entries(r.months).slice(0, 6);
        const max = Math.max(1, ...months.map(([, c]) => c.projected));
        return (
          <div key={r.id} onClick={() => onOpen(r.id)} className={cn("cursor-pointer rounded-lg border border-border bg-card p-4 transition hover:border-accent hover:shadow-sm", !r.include && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5"><NameButton row={r} onOpen={onOpen} className="font-semibold" /><Warn row={r} /></div>
                <div className="truncate text-xs text-muted-foreground">{sub(r) || "—"}</div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>{actions(r)}</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <StatusBadge status={r.status} />
              <span className="text-muted-foreground">{formatDate(r.forecast_start)} – {formatDate(r.forecast_finish)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Remaining</div><div className="font-semibold tabular-nums">{formatMoney(r.remaining)}</div></div>
              <div className="text-right"><div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Total</div><div className="tabular-nums">{formatMoney(r.total_revenue)}</div></div>
            </div>
            <div className="mt-3 flex h-10 items-end gap-1" aria-label="Next 6 months forecast">
              {months.map(([m, c]) => (
                <div key={m} className="flex flex-1 flex-col items-center gap-0.5" title={`${monthLabel(m)}: ${formatMoney(c.projected)}`}>
                  <div className="w-full rounded-sm bg-accent" style={{ height: `${Math.max(c.projected ? 8 : 2, (c.projected / max) * 28)}px`, opacity: c.projected ? 0.75 : 0.2 }} />
                  <span className="text-[9px] text-muted-foreground">{monthLabel(m).slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 truncate text-[11px] text-muted-foreground">PM {r.pms.join(", ") || "—"} · Super {r.supers.join(", ") || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar (project spans) ─────────────────────────────────────────────

// Explicit colours: the theme's accent/info tokens don't take opacity modifiers.
const STATUS_HEX: Record<ProjectionStatus, string> = { contracted: "#15803d", preconstruction: "#b7541f", likely: "#2563eb", proposal: "#6b7280", on_hold: "#ca8a04" };
const barStyle = (status: ProjectionStatus): React.CSSProperties => ({ background: `${STATUS_HEX[status]}24`, borderColor: `${STATUS_HEX[status]}66`, color: STATUS_HEX[status] });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parse = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function CalendarView({ rows, onOpen, today }: Omit<ViewProps, "actions"> & { today: string }) {
  const todayDate = parse(today);
  const [mode, setMode] = React.useState<"month" | "week">("month");
  const [cursor, setCursor] = React.useState(todayDate);

  const spans = rows.filter((r) => r.forecast_start && r.forecast_finish).map((r) => ({ row: r, s: parse(r.forecast_start!), e: parse(r.forecast_finish!) }));
  const undated = rows.filter((r) => !r.forecast_start || !r.forecast_finish);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = mode === "month" ? addDays(first, -first.getDay()) : addDays(cursor, -cursor.getDay());
  const weekCount = mode === "month" ? Math.ceil((first.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7) : 1;
  const weeks = Array.from({ length: weekCount }, (_, i) => addDays(gridStart, i * 7));
  const title = mode === "month"
    ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${gridStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(gridStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const move = (n: number) => setCursor((c) => (mode === "month" ? new Date(c.getFullYear(), c.getMonth() + n, 1) : addDays(c, 7 * n)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="px-2 py-1.5 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(todayDate)} className="border-x border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="px-2 py-1.5 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h3 className="font-semibold">{title}</h3>
        <div className="ml-auto flex overflow-hidden rounded-md border border-border text-xs">
          {(["month", "week"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("px-3 py-1.5 font-medium capitalize", mode === m ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>{m}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
        </div>
        {weeks.map((ws) => {
          const we = addDays(ws, 6);
          // Segments of each project span that fall in this week, packed into lanes.
          const segs = spans
            .filter((x) => x.s <= we && x.e >= ws)
            .map((x) => ({ ...x, a: Math.max(0, dayDiff(ws, x.s)), b: Math.min(6, dayDiff(ws, x.e)), cl: x.s < ws, cr: x.e > we }))
            .sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
          const laneEnds: number[] = [];
          const placed = segs.map((sg) => {
            let lane = laneEnds.findIndex((end) => end < sg.a);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(sg.b); } else laneEnds[lane] = sg.b;
            return { ...sg, lane };
          });
          return (
            <div key={ws.toISOString()} className={cn("border-b border-border last:border-b-0", mode === "week" ? "min-h-[320px]" : "min-h-[112px]")}>
              <div className="grid grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(ws, i);
                  const outside = mode === "month" && d.getMonth() !== cursor.getMonth();
                  return (
                    <div key={i} className={cn("border-r border-border px-2 pt-1 text-xs last:border-r-0", outside && "text-muted-foreground/50")}>
                      <span className={cn("inline-grid h-6 min-w-6 place-items-center rounded-full px-1", sameDay(d, todayDate) && "bg-accent font-semibold text-accent-foreground")}>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 gap-y-1 px-1 pb-2 pt-1">
                {placed.map((sg) => (
                  <button key={sg.row.id} type="button" onClick={() => onOpen(sg.row.id)}
                    title={`${sg.row.name} · ${formatDate(sg.row.forecast_start)} – ${formatDate(sg.row.forecast_finish)} · ${formatMoney(sg.row.remaining)} remaining`}
                    style={{ gridColumn: `${sg.a + 1} / ${sg.b + 2}`, gridRow: sg.lane + 1, ...barStyle(sg.row.status) }}
                    className={cn("mx-0.5 truncate border px-2 py-0.5 text-left text-[11px] font-medium hover:brightness-95",
                      sg.cl ? "rounded-l-none border-l-0" : "rounded-l-md", sg.cr ? "rounded-r-none border-r-0" : "rounded-r-md", !sg.row.include && "opacity-60")}>
                    {sg.cl ? "← " : ""}{sg.row.name}{mode === "week" ? ` · ${formatMoney(sg.row.remaining, { compact: true })}` : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-3 text-xs">
          <span className="font-medium">No forecast dates:</span>{" "}
          {undated.map((r, i) => <React.Fragment key={r.id}>{i > 0 && ", "}<button type="button" onClick={() => onOpen(r.id)} className="text-accent hover:underline">{r.name}</button></React.Fragment>)}
        </div>
      )}
    </div>
  );
}

// ── Map ──────────────────────────────────────────────────────────────────

const PIN_COLOR = STATUS_HEX;

export function MapView({ rows, onOpen }: Omit<ViewProps, "actions">) {
  const pins: MapPin[] = React.useMemo(() => rows.filter((r) => r.location.lat != null && r.location.lng != null).map((r) => ({
    id: r.id, lat: r.location.lat as number, lng: r.location.lng as number, color: PIN_COLOR[r.status], title: r.name,
    lines: [`${PROJECTION_STATUS_META[r.status].label} · ${formatMoney(r.remaining)} remaining`, r.location.address ?? ""].filter(Boolean),
  })), [rows]);
  const unmapped = rows.filter((r) => r.location.lat == null || r.location.lng == null);
  return (
    <div className="space-y-2">
      <PinMap pins={pins} onOpen={onOpen} openLabel="Open projection" />
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>{pins.length} of {rows.length} plotted.</span>
        {(Object.keys(PIN_COLOR) as ProjectionStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIN_COLOR[s] }} />{PROJECTION_STATUS_META[s].label}</span>
        ))}
      </div>
      {unmapped.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-3 text-xs">
          <span className="font-medium">No location:</span>{" "}
          {unmapped.map((r, i) => <React.Fragment key={r.id}>{i > 0 && ", "}<button type="button" onClick={() => onOpen(r.id)} className="text-accent hover:underline">{r.name}</button></React.Fragment>)}
          <span className="text-muted-foreground"> — add an address on the job, the deal, or (for anticipated work) in the projection.</span>
        </div>
      )}
    </div>
  );
}
