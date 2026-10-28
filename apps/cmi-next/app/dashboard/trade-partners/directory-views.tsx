"use client";

// The trade partner Directory's six views: Table, List, Cards, Kanban (by
// qualification status), Calendar (expiries and renewals) and Map. Same
// rows, same selection (for Requalify), same "open" — a partner opens their
// latest application in the review drawer.
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, Loader2, MapPin as MapPinIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PinMap, type MapPin } from "@/components/ui/pin-map";
import type { DirectoryRow } from "@/lib/companies/directory";

export type DirectoryView = "table" | "list" | "cards" | "kanban" | "calendar" | "map";

export const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);
export const when = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/15 text-info",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  info_requested: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  interview: "bg-accent/15 text-accent",
  qualified: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  approved: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  preferred: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  declined: "bg-destructive/15 text-destructive",
  suspended: "bg-destructive/15 text-destructive",
  inactive: "bg-muted text-muted-foreground",
  applicant: "bg-info/15 text-info",
  prospect: "bg-muted text-muted-foreground",
};

export const COMPLIANCE_TONE: Record<string, string> = {
  clear: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  expiring: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  expired: "bg-destructive/15 text-destructive",
  missing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  none: "bg-muted text-muted-foreground",
};

// Office names for the review states (brief §6); everything else reads as-is.
const STATUS_LABEL: Record<string, string> = { in_review: "Under review", info_requested: "Waiting on documents", interview: "Follow-up meeting" };
export const pretty = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Pin colours on the map, by where the partner is in qualification. */
const STATUS_PIN: Record<string, string> = {
  approved: "#059669", preferred: "#047857", qualified: "#10b981",
  applicant: "#2563eb", in_review: "#d97706", interview: "#9a6a2f",
  declined: "#dc2626", suspended: "#dc2626", inactive: "#6b7280", prospect: "#9ca3af",
};

export type ViewProps = {
  rows: DirectoryRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll?: (ids: string[], on: boolean) => void;
  canDecide: boolean;
  onOpen: (row: DirectoryRow) => void;
  onExclude: (id: string, excluded: boolean) => void;
};

// ─── Small shared pieces ────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[status] ?? "bg-muted")}>{pretty(status)}</span>;
}

function CompliancePill({ row }: { row: DirectoryRow }) {
  if (row.docs_total === 0) return <span className="text-[11px] text-muted-foreground">No documents</span>;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", COMPLIANCE_TONE[row.compliance])}>
      {row.compliance === "clear" ? "Docs verified" : row.compliance === "missing" ? `${row.docs_outstanding} outstanding` : pretty(row.compliance)}
    </span>
  );
}

function Flags({ flags, compact }: { flags: string[]; compact?: boolean }) {
  if (!flags.length) return null;
  if (compact) {
    return (
      <span title={flags.join(" · ")} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
        <Flag className="h-3 w-3" /> {flags.length === 1 ? flags[0] : `${flags.length} flags`}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
          <Flag className="h-3 w-3" /> {f}
        </span>
      ))}
    </div>
  );
}

function Check({ row, selected, onToggle }: Pick<ViewProps, "selected" | "onToggle"> & { row: DirectoryRow }) {
  return (
    <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={selected.has(row.id)} onChange={() => onToggle(row.id)}
      onClick={(e) => e.stopPropagation()} aria-label={`Select ${row.name} for requalification`} />
  );
}

/** The company name as the "open" control, so every view opens the same way. */
function OpenName({ row, onOpen, className }: { row: DirectoryRow; onOpen: (r: DirectoryRow) => void; className?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row); }} title={row.application_id ? "Open their application" : row.name}
      className={cn("truncate text-left font-medium hover:text-accent hover:underline", className)}>
      {row.name}
    </button>
  );
}

function ContactsLink({ row }: { row: DirectoryRow }) {
  if (row.contact_count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <Link href={`/dashboard/contacts?q=${encodeURIComponent(row.name)}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-accent hover:underline">
      <Users className="h-3 w-3" /> {row.contact_count}
    </Link>
  );
}

const size = (r: DirectoryRow) => (r.min_project_value == null && r.max_project_value == null ? "—" : `${money(r.min_project_value)} – ${money(r.max_project_value)}`);

// ─── Table ──────────────────────────────────────────────────────────────────

export function DirectoryTable({ rows, selected, onToggle, onToggleAll, canDecide, onOpen }: ViewProps) {
  const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="cmi-table-scroll overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-max border-collapse whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {canDecide && (
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-[var(--accent)]" checked={all}
                  onChange={(e) => onToggleAll?.(rows.map((r) => r.id), e.target.checked)} />
              </th>
            )}
            <th className={th}>Company</th>
            <th className={th}>Type</th>
            <th className={th}>Status</th>
            <th className={th}>Documents</th>
            <th className={th}>Red flags</th>
            <th className={th}>Trades</th>
            <th className={th}>Areas</th>
            <th className={th}>Project size</th>
            <th className={th}>Crew</th>
            <th className={th}>Next expiry</th>
            <th className={th}>Contacts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r)} className={cn("cursor-pointer transition hover:bg-muted/30", selected.has(r.id) && "bg-accent/5")}>
              {canDecide && <td className="px-3 py-2.5"><Check row={r} selected={selected} onToggle={onToggle} /></td>}
              <td className="px-3 py-2.5"><OpenName row={r} onOpen={onOpen} className="block max-w-[16rem]" /></td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.partner_type ?? "—"}</td>
              <td className="px-3 py-2.5"><StatusPill status={r.qualification_status} /></td>
              <td className="px-3 py-2.5"><CompliancePill row={r} /></td>
              <td className="px-3 py-2.5">{r.red_flags.length ? <Flags flags={r.red_flags} compact /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2.5 text-muted-foreground">
                <span className="block max-w-[14rem] truncate" title={(r.trades ?? []).join(", ")}>{(r.trades ?? []).join(", ") || "—"}</span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                <span className="block max-w-[12rem] truncate" title={(r.service_areas ?? []).join(", ")}>{(r.service_areas ?? []).join(", ") || "—"}</span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{size(r)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.employee_count ?? "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{when(r.next_expiry)}</td>
              <td className="px-3 py-2.5"><ContactsLink row={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── List ───────────────────────────────────────────────────────────────────

export function DirectoryList({ rows, selected, onToggle, canDecide, onOpen }: ViewProps) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} onClick={() => onOpen(r)}
          className={cn("flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition hover:border-accent/40",
            r.red_flags.length ? "border-destructive/40" : "border-border", selected.has(r.id) && "bg-accent/5")}>
          {canDecide && <Check row={r} selected={selected} onToggle={onToggle} />}
          <div className="min-w-0 flex-1">
            <OpenName row={r} onOpen={onOpen} className="block max-w-full text-sm" />
            <p className="truncate text-xs text-muted-foreground">
              {[r.partner_type, r.city, (r.trades ?? []).slice(0, 3).join(", ")].filter(Boolean).join(" · ") || "No details yet"}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Flags flags={r.red_flags} compact />
            <CompliancePill row={r} />
          </div>
          <StatusPill status={r.qualification_status} />
        </li>
      ))}
    </ul>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export function DirectoryCards({ rows, selected, onToggle, canDecide, onOpen, onExclude }: ViewProps) {
  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {rows.map((c) => (
        <li key={c.id} className={cn("rounded-lg border bg-card p-4", c.red_flags.length ? "border-destructive/40" : "border-border", selected.has(c.id) && "bg-accent/5")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {canDecide && <span className="mt-1"><Check row={c} selected={selected} onToggle={onToggle} /></span>}
              <div className="min-w-0">
                <OpenName row={c} onOpen={onOpen} className="block max-w-full" />
                <p className="text-xs text-muted-foreground">{[c.partner_type, c.city].filter(Boolean).join(" · ") || "No details yet"}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusPill status={c.qualification_status} />
              {c.docs_total > 0 && <CompliancePill row={c} />}
            </div>
          </div>

          {(c.trades?.length || c.service_areas?.length) ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(c.trades ?? []).slice(0, 4).map((t) => (
                <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{t}</span>
              ))}
              {(c.service_areas ?? []).slice(0, 3).map((a) => (
                <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
              ))}
            </div>
          ) : null}

          <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div><dt>Project size</dt><dd className="text-foreground">{size(c)}</dd></div>
            <div><dt>Crew</dt><dd className="text-foreground">{c.employee_count ?? "—"}</dd></div>
            <div><dt>At once</dt><dd className="text-foreground">{c.concurrent_capacity ?? "—"}</dd></div>
          </dl>

          {c.red_flags.length > 0 && <div className="mt-2"><Flags flags={c.red_flags} /></div>}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {c.contact_count > 0 && <span className="inline-flex items-center gap-1"><ContactsLink row={c} /> contact{c.contact_count === 1 ? "" : "s"}</span>}
            {c.last_requalified_at && <span>Requalified {when(c.last_requalified_at)}</span>}
            {c.requal_requested_at && (!c.last_requalified_at || c.requal_requested_at > c.last_requalified_at) && (
              <span>Update requested {when(c.requal_requested_at)}</span>
            )}
            {canDecide && (
              <button type="button" className="ml-auto hover:text-foreground hover:underline" onClick={() => onExclude(c.id, !c.requal_excluded)}
                title="Excluded partners are left out of select-all requalification sends">
                {c.requal_excluded ? "Excluded from requalification · include" : "Exclude from requalification"}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Kanban (by qualification status) ───────────────────────────────────────

const KANBAN_ORDER = ["prospect", "applicant", "in_review", "interview", "qualified", "approved", "preferred", "suspended", "declined", "inactive"];
/** Always shown, even empty, so the pipeline reads left to right. */
const KANBAN_CORE = new Set(["applicant", "in_review", "interview", "approved", "preferred"]);

export function DirectoryKanban({ rows, onOpen }: ViewProps) {
  const cols = KANBAN_ORDER
    .map((status) => ({ status, items: rows.filter((r) => r.qualification_status === status) }))
    .filter((c) => c.items.length > 0 || KANBAN_CORE.has(c.status));
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Grouped by qualification status. Status changes go through the application (Approve, Decline, Follow up) so the right emails go out.
      </p>
      <div className="cmi-table-scroll flex gap-3 overflow-x-auto pb-2">
        {cols.map((col) => (
          <div key={col.status} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <StatusPill status={col.status} />
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.items.length}</span>
            </div>
            <div className="min-h-[60px] space-y-2 p-2">
              {col.items.length === 0 && <div className="rounded-md border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">None</div>}
              {col.items.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpen(r)}
                  className={cn("block w-full rounded-md border bg-background p-2.5 text-left transition hover:border-accent/40", r.red_flags.length ? "border-destructive/40" : "border-border")}>
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{[r.partner_type, (r.trades ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "No details yet"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {r.docs_total > 0 && <CompliancePill row={r} />}
                    <Flags flags={r.red_flags} compact />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Calendar (document expiries and qualification renewals) ────────────────

type CalEvent = { row: DirectoryRow; label: string; date: string; tone: string };

export function DirectoryCalendar({ rows, onOpen }: ViewProps) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const add = (e: CalEvent) => (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    for (const r of rows) {
      if (r.next_expiry) {
        add({ row: r, date: r.next_expiry, label: "Document expires",
          tone: r.next_expiry < todayIso ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300" });
      }
      if (r.qualification_expires_at) {
        add({ row: r, date: r.qualification_expires_at.slice(0, 10), label: "Qualification renews", tone: "bg-accent/10 text-accent" });
      }
    }
    return map;
  }, [rows, todayIso]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const step = (delta: number) => setCursor((cur) => { const m = cur.m + delta; return { y: cur.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const iso = (day: number) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthCount = cells.reduce<number>((n, d) => n + (d ? (byDay.get(iso(d))?.length ?? 0) : 0), 0);
  // The soonest date from today on, so an empty month still points somewhere.
  const nextDate = [...byDay.keys()].filter((d) => d >= todayIso).sort()[0];
  const next = nextDate ? byDay.get(nextDate)![0] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          <p className="text-xs text-muted-foreground">
            Insurance and license expiries, and yearly qualification renewals · {monthCount} this month
            {next && (
              <>
                {" · "}
                <button type="button" className="text-accent hover:underline"
                  onClick={() => { const d = new Date(`${next.date}T12:00:00`); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>
                  Next: {next.row.name}, {next.label.toLowerCase()} {when(next.date)}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Today</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-24 bg-background" />;
          const items = byDay.get(iso(day)) ?? [];
          const isToday = iso(day) === todayIso;
          return (
            <div key={day} className="min-h-24 bg-background p-1.5">
              <div className={cn("mb-1 text-[11px] font-medium", isToday ? "text-accent" : "text-muted-foreground")}>{day}</div>
              <div className="space-y-1">
                {items.slice(0, 3).map((e) => (
                  <button key={`${e.row.id}-${e.label}`} type="button" onClick={() => onOpen(e.row)} title={`${e.row.name}: ${e.label}`}
                    className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] hover:opacity-80", e.tone)}>
                    {e.row.name}
                  </button>
                ))}
                {items.length > 3 && <div className="px-1.5 text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Map ────────────────────────────────────────────────────────────────────

export function DirectoryMap({ rows, onOpen, onReload }: ViewProps & { onReload: () => void }) {
  const mapped = rows.filter((r) => r.latitude != null && r.longitude != null);
  const missing = rows.filter((r) => r.latitude == null && (r.street_address || r.city || r.zip)).length;
  const noAddress = rows.filter((r) => r.latitude == null && !r.street_address && !r.city && !r.zip).length;
  const [locating, setLocating] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const locate = React.useCallback(async () => {
    setLocating(true); setNote(null);
    const res = await fetch("/api/trade-partners/geocode", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setLocating(false);
    if (!res.ok) { setNote(json.error ?? "Couldn't place partners on the map."); return; }
    if (json.located) onReload();
    if (json.failed) setNote(`${json.failed} address${json.failed === 1 ? "" : "es"} couldn't be found.`);
  }, [onReload]);

  // Place anyone not on the map yet, once per visit.
  const tried = React.useRef(false);
  React.useEffect(() => {
    if (tried.current || missing === 0) return;
    tried.current = true;
    void locate();
  }, [missing, locate]);

  const pins: MapPin[] = mapped.map((r) => ({
    id: r.id, lat: r.latitude as number, lng: r.longitude as number, title: r.name,
    lines: [
      [r.partner_type, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      (r.trades ?? []).slice(0, 3).join(", "),
      pretty(r.qualification_status) + (r.red_flags.length ? ` · ${r.red_flags.join(", ")}` : ""),
    ].filter(Boolean),
    color: STATUS_PIN[r.qualification_status] ?? "#9a6a2f",
  }));

  return (
    <div className="space-y-2">
      <PinMap pins={pins} onOpen={(id) => { const r = rows.find((x) => x.id === id); if (r) onOpen(r); }} openLabel="Open" />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" /> {mapped.length} of {rows.length} partners on the map.</span>
        {locating && <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Placing {missing} more…</span>}
        {!locating && missing > 0 && <button type="button" className="text-accent hover:underline" onClick={() => void locate()}>Place {missing} more</button>}
        {noAddress > 0 && <span>{noAddress} without an address or city.</span>}
        {note && <span className="text-destructive">{note}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {[["Approved", "#059669"], ["Applicant", "#2563eb"], ["Under review", "#d97706"], ["Follow-up", "#9a6a2f"], ["Declined", "#dc2626"]].map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </span>
      </p>
    </div>
  );
}
