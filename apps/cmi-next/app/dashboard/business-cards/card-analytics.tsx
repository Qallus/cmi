"use client";

import * as React from "react";
import {
  ArrowLeft, Copy, Eye, Heart, MousePointerClick, Phone, Share2,
  Smartphone, UserPlus, QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessCard } from "@/lib/business-cards/types";
import type { CardAnalytics } from "@/lib/business-cards/data";

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");

export function CardAnalyticsView({ card, onClose }: { card: BusinessCard; onClose: () => void }) {
  const [data, setData] = React.useState<CardAnalytics | null>(null);
  const [range, setRange] = React.useState(30);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/business-cards/${card.id}/analytics?range=${range}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (cancelled) return; if (!ok) setError(j.error || "Failed."); else setData(j.analytics); })
      .catch(() => { if (!cancelled) setError("Failed to load analytics."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [card.id, range]);

  const name = card.display_name || card.card_name;
  const maxViews = Math.max(1, ...(data?.daily.map((d) => d.views + d.clicks) ?? [1]));

  const tiles = [
    { label: "Views", value: data?.views, icon: Eye, tint: "text-blue-500" },
    { label: "Clicks", value: data?.clicks, icon: MousePointerClick, tint: "text-amber-500" },
    { label: "Shares", value: data?.shares, icon: Share2, tint: "text-purple-500" },
    { label: "Saves", value: data?.saves, icon: UserPlus, tint: "text-emerald-500" },
    { label: "Leads", value: data?.leads, icon: Phone, tint: "text-rose-500" },
    { label: "Likes", value: data?.totals.like ?? 0, icon: Heart, tint: "text-pink-500" },
    { label: "QR scans", value: data?.totals.qr_scan ?? 0, icon: QrCode, tint: "text-foreground" },
    { label: "NFC taps", value: data?.totals.nfc_tap ?? 0, icon: Smartphone, tint: "text-cyan-500" },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Analytics</div>
            <div className="font-display text-lg font-semibold">{name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
            {[7, 30, 90].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("rounded-md px-3 py-1.5 font-medium", range === r ? "bg-accent/15 text-accent" : "text-muted-foreground")}>{r}d</button>
            ))}
          </div>
          <a href={`${PUBLIC_BASE}/c/${card.slug}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /> Public page</Button></a>
        </div>
      </div>

      <div className="p-5">
        {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {/* Tiles */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><t.icon className={cn("h-3.5 w-3.5", t.tint)} />{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : (t.value ?? 0)}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Activity chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Activity</div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" />Views</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" />Clicks</span>
              </div>
            </div>
            {loading ? (
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="flex h-44 items-end gap-1">
                {(data?.daily ?? []).map((d) => (
                  <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.views} views, ${d.clicks} clicks`}>
                    <div className="flex w-full flex-col justify-end" style={{ height: "150px" }}>
                      <div className="w-full rounded-t-sm bg-amber-500/80" style={{ height: `${(d.clicks / maxViews) * 100}%` }} />
                      <div className="w-full bg-blue-500/80" style={{ height: `${(d.views / maxViews) * 100}%` }} />
                    </div>
                    <span className="text-[8px] text-muted-foreground">{d.date}</span>
                  </div>
                ))}
                {!data?.daily.length && <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">No activity yet.</div>}
              </div>
            )}
          </div>

          {/* Top links */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Top links</div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded bg-muted" />)}</div>
            ) : data?.topLinks.length ? (
              <div className="space-y-2">
                {data.topLinks.map((l) => {
                  const max = Math.max(1, ...data.topLinks.map((x) => x.count));
                  return (
                    <div key={l.label}>
                      <div className="mb-0.5 flex items-center justify-between text-xs"><span className="truncate">{l.label}</span><span className="tabular-nums text-muted-foreground">{l.count}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(l.count / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No link clicks tracked yet.</p>
            )}
            <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
              <Copy className="h-3 w-3" /> Copy-link actions: <span className="font-medium text-foreground">{data?.totals.copy_link ?? 0}</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Showing the last {range} days. Lifetime totals appear on the card list.</p>
      </div>
    </div>
  );
}
