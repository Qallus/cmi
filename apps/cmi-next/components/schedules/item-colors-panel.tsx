"use client";

// Colours for one task on the Gantt: its bar, and the link lines into it
// (before) and out of it (after). Opened by double-clicking a bar. Colours are
// saved on the task and its links, so everyone sees the same Gantt.
import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScheduleItem, ScheduleDependency, LineStyle } from "@/lib/schedules/types";

export const BAR_DEFAULT = "#9e6f2e";
export const LINK_DEFAULT = "#9e6f2e";

export const COLOR_SWATCHES: [string, string][] = [
  ["#9e6f2e", "Bronze"], ["#2f2b28", "Charcoal"], ["#5b6b7a", "Slate"], ["#2f6fb0", "Blue"],
  ["#1f8a84", "Teal"], ["#3f8a3a", "Green"], ["#7a7a2e", "Olive"], ["#c98a12", "Amber"],
  ["#d0651f", "Orange"], ["#b83a3a", "Red"], ["#7b4a8c", "Plum"], ["#8a8580", "Gray"],
];

/** SVG dash pattern for a line style ("solid" has none). */
export function dashFor(style: LineStyle): string | undefined {
  return style === "dotted" ? "2 2" : style === "dashed" ? "5 3" : undefined;
}

const TYPE_SHORT: Record<string, string> = { finish_to_start: "FS", start_to_start: "SS", finish_to_finish: "FF", start_to_finish: "SF" };
const STYLES: [LineStyle | null, string][] = [[null, "Auto"], ["solid", "Solid"], ["dotted", "Dotted"], ["dashed", "Dashed"]];

type LinkDraft = { color: string | null; style: LineStyle | null };

export function ItemColorsPanel({ item, items, dependencies, defaultBar, onClose, onSaved }: {
  item: ScheduleItem | null;
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  /** The bar's colour when no colour is set (the schedule's colour). */
  defaultBar?: string;
  onClose: () => void;
  onSaved: (item: ScheduleItem) => Promise<void> | void;
}) {
  const title = item ? `Colors · ${item.activity_id != null ? `${item.activity_id} ` : ""}${item.title}` : "Colors";
  return (
    <ScheduleModal open={!!item} title={title} onClose={onClose} side>
      {item ? <ColorsBody key={item.id} item={item} items={items} dependencies={dependencies} defaultBar={defaultBar ?? BAR_DEFAULT} onClose={onClose} onSaved={onSaved} /> : null}
    </ScheduleModal>
  );
}

function ColorsBody({ item, items, dependencies, defaultBar, onClose, onSaved }: {
  item: ScheduleItem; items: ScheduleItem[]; dependencies: ScheduleDependency[]; defaultBar: string;
  onClose: () => void; onSaved: (item: ScheduleItem) => Promise<void> | void;
}) {
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const before = dependencies.filter((d) => d.target_item_id === item.id);
  const after = dependencies.filter((d) => d.source_item_id === item.id);
  const [bar, setBar] = React.useState<string | null>(item.bar_color ?? null);
  const [links, setLinks] = React.useState<Record<string, LinkDraft>>(() =>
    Object.fromEntries([...before, ...after].map((d) => [d.id, { color: d.line_color ?? null, style: d.line_style ?? null }])));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setLink = (id: string, patch: Partial<LinkDraft>) => setLinks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  const setAll = (deps: ScheduleDependency[], patch: Partial<LinkDraft>) => setLinks((m) => {
    const next = { ...m };
    for (const d of deps) next[d.id] = { ...next[d.id], ...patch };
    return next;
  });

  const changedLinks = [...before, ...after].filter((d) => (links[d.id]?.color ?? null) !== (d.line_color ?? null) || (links[d.id]?.style ?? null) !== (d.line_style ?? null));
  const barChanged = bar !== (item.bar_color ?? null);
  const dirty = barChanged || changedLinks.length > 0;

  async function save() {
    setSaving(true); setError(null);
    try {
      const calls: Promise<Response>[] = [];
      if (barChanged) calls.push(fetch(`/api/schedule-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bar_color: bar, cascade: false }) }));
      for (const d of changedLinks) calls.push(fetch(`/api/schedule-dependencies/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line_color: links[d.id].color, line_style: links[d.id].style }) }));
      const res = await Promise.all(calls);
      const bad = res.find((r) => !r.ok);
      if (bad) { const j = await bad.json().catch(() => ({})); throw new Error((j as { error?: string }).error || "Couldn't save the colors."); }
      await onSaved(item);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  const otherLabel = (d: ScheduleDependency, side: "before" | "after") => {
    const other = byId.get(side === "before" ? d.source_item_id : d.target_item_id);
    const lag = d.lag_days ? `${d.lag_days > 0 ? "+" : ""}${d.lag_days}` : "";
    return { name: other ? `${other.activity_id != null ? `${other.activity_id} ` : ""}${other.title}` : "Another task", link: `${TYPE_SHORT[d.dependency_type] ?? ""}${lag}` };
  };

  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bar color</h4>
        <div className="mt-2 flex h-7 items-center overflow-hidden rounded px-2 text-xs text-white shadow-sm" style={{ background: bar ?? defaultBar }}>
          <span className="truncate">{item.title}</span>
        </div>
        <Swatches className="mt-3" value={bar} onChange={setBar} autoColor={defaultBar} autoLabel="Schedule color" />
      </section>

      <LinkGroup title="Lines before" empty="Nothing comes before this task." deps={before} side="before" links={links} label={otherLabel}
        onOne={setLink} onAll={(p) => setAll(before, p)} />
      <LinkGroup title="Lines after" empty="Nothing follows this task." deps={after} side="after" links={links} label={otherLabel}
        onOne={setLink} onAll={(p) => setAll(after, p)} />

      <p className="text-xs text-muted-foreground">Auto keeps the standard look: dotted bronze lines, solid charcoal on the critical path. Colors are saved on the schedule, so everyone sees them.</p>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" variant="ghost" disabled={saving || (bar === null && Object.values(links).every((l) => !l.color && !l.style))}
          onClick={() => { setBar(null); setAll([...before, ...after], { color: null, style: null }); }}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset all
        </Button>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" size="sm" variant="accent" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save colors</Button>
        </div>
      </div>
    </div>
  );
}

function LinkGroup({ title, empty, deps, side, links, label, onOne, onAll }: {
  title: string; empty: string; deps: ScheduleDependency[]; side: "before" | "after";
  links: Record<string, LinkDraft>;
  label: (d: ScheduleDependency, side: "before" | "after") => { name: string; link: string };
  onOne: (id: string, patch: Partial<LinkDraft>) => void;
  onAll: (patch: Partial<LinkDraft>) => void;
}) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}{deps.length ? ` (${deps.length})` : ""}</h4>
      {!deps.length ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : (
        <div className="mt-2 space-y-2">
          {deps.length > 1 ? (
            <div className="rounded-lg border border-dashed border-border p-3">
              <div className="mb-2 text-xs font-medium">All {deps.length} lines {side}</div>
              <Swatches value={null} onChange={(color) => onAll({ color })} autoColor={LINK_DEFAULT} compact />
              <StylePicker className="mt-2" value={null} onChange={(style) => onAll({ style })} />
            </div>
          ) : null}
          {deps.map((d) => {
            const l = links[d.id] ?? { color: null, style: null };
            const { name, link } = label(d, side);
            return (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <LineSample color={l.color ?? LINK_DEFAULT} style={l.style ?? "dotted"} />
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{link}</span>
                </div>
                <Swatches className="mt-2" value={l.color} onChange={(color) => onOne(d.id, { color })} autoColor={LINK_DEFAULT} compact />
                <StylePicker className="mt-2" value={l.style} onChange={(style) => onOne(d.id, { style })} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Swatches({ value, onChange, autoColor, autoLabel = "Auto", compact, className }: {
  value: string | null; onChange: (c: string | null) => void; autoColor: string; autoLabel?: string; compact?: boolean; className?: string;
}) {
  const size = compact ? "h-5 w-5" : "h-7 w-7";
  const custom = value && !COLOR_SWATCHES.some(([c]) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} title={autoLabel}
        className={cn("flex items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition", compact ? "h-5" : "h-7", value === null ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: autoColor }} /> {autoLabel}
      </button>
      {COLOR_SWATCHES.map(([c, name]) => (
        <button key={c} type="button" onClick={() => onChange(c)} title={name} aria-label={name} aria-pressed={value?.toLowerCase() === c}
          className={cn(size, "rounded-full ring-offset-2 ring-offset-card transition hover:scale-110", value?.toLowerCase() === c && "ring-2 ring-foreground")} style={{ background: c }} />
      ))}
      <label title="Custom color" className={cn(size, "relative cursor-pointer overflow-hidden rounded-full border border-border ring-offset-2 ring-offset-card", custom && "ring-2 ring-foreground")}
        style={{ background: custom ? value! : "conic-gradient(#b83a3a, #c98a12, #3f8a3a, #1f8a84, #2f6fb0, #7b4a8c, #b83a3a)" }}>
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value ?? autoColor} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
      </label>
    </div>
  );
}

function StylePicker({ value, onChange, className }: { value: LineStyle | null; onChange: (s: LineStyle | null) => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-md border border-border p-0.5", className)} role="group" aria-label="Line style">
      {STYLES.map(([s, label]) => (
        <button key={label} type="button" onClick={() => onChange(s)} aria-pressed={value === s}
          className={cn("flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition", value === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {s ? <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dashFor(s)} /></svg> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

function LineSample({ color, style }: { color: string; style: LineStyle }) {
  return (
    <svg width="28" height="8" className="shrink-0" aria-hidden>
      <line x1="0" y1="4" x2="22" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray={dashFor(style)} />
      <path d="M22,1 L27,4 L22,7 Z" fill={color} />
    </svg>
  );
}
