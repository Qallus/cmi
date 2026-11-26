"use client";

// "All features": every CMI feature in one slide-out (side panel on desktop,
// bottom sheet on a phone), grouped, with search. Each card links to its page;
// how-to entries (like the Claude connector) open their steps in place.
// Filtered to what this person can open. (Echo's FeatureMenu, for CMI.)
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Search } from "lucide-react";
import { FEATURE_GROUPS, featureCatalog, visibleFeatures, type Feature } from "@/lib/features/catalog";
import { cn } from "@/lib/utils";
import { panelColumns, useSidePanelWidth } from "@/components/ui/side-panel";
import { ResponsivePanel } from "./responsive-panel";

export function FeatureMenu({ open, onOpenChange, role, flags, appUrl }: {
  open: boolean; onOpenChange: (o: boolean) => void; role: string; flags: Record<string, boolean>; appUrl: string;
}) {
  const [q, setQ] = useState("");
  const all = useMemo(() => featureCatalog(appUrl), [appUrl]);
  const list = visibleFeatures(all, role, flags, q);
  const close = () => { onOpenChange(false); setQ(""); };

  return (
    <ResponsivePanel open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} storageKey="all-features"
      title="All features" description="Everything CMI can do, and where to find it. Drag the left edge to widen.">
      <FeatureList list={list} q={q} setQ={setQ} onGo={close} />
    </ResponsivePanel>
  );
}

// Inside the panel, so it can read the panel's width and add columns.
function FeatureList({ list, q, setQ, onGo }: { list: Feature[]; q: string; setQ: (v: string) => void; onGo: () => void }) {
  const cols = panelColumns(useSidePanelWidth());
  const close = onGo;
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features" aria-label="Search features"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-accent" />
      </div>
      {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No feature matches. Try asking Bolt.</p>}
      {FEATURE_GROUPS.map((g) => {
        const items = list.filter((f) => f.group === g);
        if (!items.length) return null;
        return (
          <section key={g} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</h3>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {items.map((f) => <FeatureTile key={`${f.group}-${f.title}`} f={f} onGo={close} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

const tile = "flex gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TileBody({ f, trailing }: { f: Feature; trailing?: React.ReactNode }) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><f.icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">{f.title}{trailing}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{f.what}</span>
      </span>
    </>
  );
}

function FeatureTile({ f, onGo }: { f: Feature; onGo: () => void }) {
  const [openSteps, setOpenSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  if (f.steps) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", openSteps && "ring-1 ring-accent/40")} style={openSteps ? { gridColumn: "1 / -1" } : undefined}>
        <button type="button" onClick={() => setOpenSteps((v) => !v)} aria-expanded={openSteps} className={cn(tile, "w-full border-0")}>
          <TileBody f={f} trailing={<ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", openSteps && "rotate-180")} />} />
        </button>
        {openSteps && (
          <div className="space-y-3 border-t border-border px-4 py-3 text-sm">
            <ol className="list-decimal space-y-1.5 pl-5">{f.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            {f.copy && (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{f.copy.value}</code>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(f.copy!.value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : `Copy ${f.copy.label.toLowerCase()}`}
                </button>
              </div>
            )}
            {f.href && <Link href={f.href} onClick={onGo} className="inline-block text-xs underline">Open {f.title}</Link>}
          </div>
        )}
      </div>
    );
  }
  if (f.external) {
    return (
      <a href={f.href} target="_blank" rel="noreferrer" className={tile}>
        <TileBody f={f} trailing={<ExternalLink className="size-3 text-muted-foreground" />} />
      </a>
    );
  }
  return <Link href={f.href ?? "#"} onClick={onGo} className={tile}><TileBody f={f} /></Link>;
}
