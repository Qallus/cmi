"use client";

import * as React from "react";
import { DoorOpen, Fence, Footprints, Home, Paintbrush, Search, Trees, Umbrella, Waves, X } from "lucide-react";
import { STAMP_CATEGORIES, type StampItem } from "@/lib/canvas/types";

// One icon per category — with ~110 elements, per-item art would be noise.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wall: Paintbrush,
  outdoor: Umbrella,
  landscape: Trees,
  hardscape: Footprints,
  openings: DoorOpen,
  structures: Home,
  pool: Waves,
  property: Fence,
};

export function StampTray({ onAdd }: { onAdd: (kind: string, label: string) => void }) {
  const [activeKey, setActiveKey] = React.useState(STAMP_CATEGORIES[0].key);
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim().toLowerCase();
  const searching = trimmed.length > 0;

  // Searching spans every category; otherwise show the selected one.
  const results: StampItem[] = React.useMemo(() => {
    if (!searching) return STAMP_CATEGORIES.find((c) => c.key === activeKey)?.items ?? [];
    return STAMP_CATEGORIES.flatMap((c) => c.items).filter((i) => i.label.toLowerCase().includes(trimmed));
  }, [searching, trimmed, activeKey]);

  // Reset scroll when the visible set changes, so the user starts at the top.
  React.useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [activeKey, trimmed]);

  const ActiveIcon = CATEGORY_ICONS[activeKey] ?? Home;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 w-[min(92vw,660px)] -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements…"
          aria-label="Search elements"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
            className="rounded p-0.5 text-muted-foreground transition hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category tabs — hidden while searching, since results span categories */}
      {!searching && (
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5" role="tablist" aria-label="Element categories">
          {STAMP_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.key] ?? Home;
            const active = c.key === activeKey;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveKey(c.key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Items */}
      <div ref={listRef} className="max-h-[210px] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No elements match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
            {results.map((item) => {
              const Icon = searching
                ? CATEGORY_ICONS[STAMP_CATEGORIES.find((c) => c.items.includes(item))?.key ?? ""] ?? ActiveIcon
                : ActiveIcon;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => onAdd(item.kind, item.label)}
                  title={searching ? `${item.label} · ${item.category}` : item.label}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-muted-foreground transition hover:bg-accent/10 hover:text-accent"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
