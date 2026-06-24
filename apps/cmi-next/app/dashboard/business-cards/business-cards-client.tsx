"use client";

import * as React from "react";
import {
  Archive, BarChart3, Copy, ExternalLink, Eye, IdCard, Mail, Pencil, Plus, QrCode,
  RefreshCw, Trash2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessCard, CardStats } from "@/lib/business-cards/types";
import type { StaffOption } from "@/lib/business-cards/data";
import { CardBuilder } from "./card-builder";
import { LeadsInbox } from "./leads-inbox";
import { CardAnalyticsView } from "./card-analytics";

type ApiResponse = {
  cards: BusinessCard[];
  stats: CardStats;
  role: string;
  staffId: string;
  isAdmin: boolean;
  staffOptions: StaffOption[];
};

const STAT_TILES: { key: keyof CardStats; label: string; hint: string }[] = [
  { key: "products", label: "Cards", hint: "Total cards" },
  { key: "published", label: "Published", hint: "Live public URLs" },
  { key: "views", label: "Views", hint: "Public profile loads" },
  { key: "clicks", label: "Clicks", hint: "Link & button actions" },
  { key: "nfcReady", label: "NFC ready", hint: "Linked to a tag" },
  { key: "shares", label: "Shares", hint: "Card shared" },
  { key: "saves", label: "Saves", hint: "Contacts saved" },
  { key: "leads", label: "Leads", hint: "Form submissions" },
];

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");

export function BusinessCardsClient() {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<"mine" | "all">("mine");
  const [view, setView] = React.useState<"cards" | "leads">("cards");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = React.useState<BusinessCard | "new" | null>(null);
  const [analyticsCard, setAnalyticsCard] = React.useState<BusinessCard | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async (which: "mine" | "all") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-cards${which === "all" ? "?scope=all" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(scope); }, [scope, load]);

  const isAdmin = data?.isAdmin ?? false;

  const filtered = React.useMemo(() => {
    const cards = data?.cards ?? [];
    if (statusFilter === "all") return cards;
    if (statusFilter === "published") return cards.filter((c) => c.status === "published");
    return cards.filter((c) => c.status !== "published");
  }, [data, statusFilter]);

  async function openEdit(card: BusinessCard) {
    // Fetch full card (with links + sections) before editing.
    const detail = await fetch(`/api/business-cards/detail?id=${card.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setEditing(detail?.card ?? card);
  }

  async function copyLink(card: BusinessCard) {
    const url = `${PUBLIC_BASE}/c/${card.slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(card.id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  async function setStatus(card: BusinessCard, status: BusinessCard["status"]) {
    await fetch(`/api/business-cards/${card.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load(scope);
  }

  async function remove(card: BusinessCard) {
    if (!window.confirm(`Delete "${card.card_name}"? This cannot be undone.`)) return;
    await fetch(`/api/business-cards/${card.id}`, { method: "DELETE" });
    load(scope);
  }

  if (analyticsCard) {
    return <CardAnalyticsView card={analyticsCard} onClose={() => setAnalyticsCard(null)} />;
  }

  if (editing) {
    return (
      <CardBuilder
        card={editing === "new" ? null : editing}
        isAdmin={isAdmin}
        staffOptions={data?.staffOptions ?? []}
        currentStaffId={data?.staffId ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(scope); }}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <h1 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <IdCard className="h-5 w-5 text-accent" /> Business Cards
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              <button onClick={() => setScope("mine")} className={cn("rounded-md px-3 py-1.5 font-medium", scope === "mine" ? "bg-accent/15 text-accent" : "text-muted-foreground")}>My cards</button>
              <button onClick={() => setScope("all")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 font-medium", scope === "all" ? "bg-accent/15 text-accent" : "text-muted-foreground")}><Users className="h-3.5 w-3.5" />All staff</button>
            </div>
          )}
          {view === "cards" && (
            <Button size="sm" variant="outline" onClick={() => load(scope)} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </Button>
          )}
          {view === "cards" && (
            <Button size="sm" variant="accent" onClick={() => setEditing("new")}>
              <Plus className="h-3.5 w-3.5" /> Create card
            </Button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-border bg-card px-4">
        {(["cards", "leads"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition",
              view === v ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "cards" ? <IdCard className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {v === "cards" ? "Cards" : "Leads"}
          </button>
        ))}
      </div>

      {view === "leads" ? (
        <LeadsInbox isAdmin={isAdmin} scope={scope} />
      ) : (
      <div className="p-5">
        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {STAT_TILES.map((t) => (
            <div key={t.key} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data ? data.stats[t.key] : "—"}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{t.hint}</div>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="mb-4 flex items-center gap-2">
          {(["all", "published", "draft"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium transition", statusFilter === f ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
              {f === "all" ? "All" : f === "published" ? "Published" : "Drafts"}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <IdCard className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No cards yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create a digital business card to get a public QR/NFC profile.</p>
            <Button size="sm" variant="accent" className="mt-4" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" /> Create card</Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                showOwner={scope === "all"}
                copied={copied === card.id}
                onEdit={() => openEdit(card)}
                onAnalytics={() => setAnalyticsCard(card)}
                onCopy={() => copyLink(card)}
                onDelete={() => remove(card)}
                onPublishToggle={() => setStatus(card, card.status === "published" ? "unpublished" : "published")}
                onArchive={() => setStatus(card, "archived")}
              />
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function CardRow({
  card, showOwner, copied, onEdit, onAnalytics, onCopy, onDelete, onPublishToggle, onArchive,
}: {
  card: BusinessCard; showOwner: boolean; copied: boolean;
  onEdit: () => void; onAnalytics: () => void; onCopy: () => void; onDelete: () => void; onPublishToggle: () => void; onArchive: () => void;
}) {
  const url = `${PUBLIC_BASE}/c/${card.slug}`;
  const name = card.display_name || [card.first_name, card.last_name].filter(Boolean).join(" ") || card.card_name;
  const published = card.status === "published";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", published ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
              {published ? "Published" : card.status === "archived" ? "Archived" : "Draft"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</div>
          {showOwner && <div className="mt-1 text-[11px] text-muted-foreground">Owner: {card.owner?.display_name || "Unassigned"}</div>}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{card.view_count}</span>
            <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" />{card.click_count}</span>
          </div>
        </div>
        <div className="shrink-0 rounded-lg bg-white p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/cards/qr?url=${encodeURIComponent(url)}&size=160`} alt="QR" className="h-16 w-16" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="accent" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={onAnalytics}><BarChart3 className="h-3.5 w-3.5" /> Analytics</Button>
        <Button size="sm" variant="outline" onClick={onCopy}><Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy link"}</Button>
        {published && <a href={url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /> Public page</Button></a>}
        <a href={`/api/cards/qr?url=${encodeURIComponent(url)}&size=1024`} download={`${card.slug}-qr.png`}><Button size="sm" variant="outline"><QrCode className="h-3.5 w-3.5" /> QR PNG</Button></a>
        <Button size="sm" variant="outline" onClick={onPublishToggle}>{published ? "Unpublish" : "Publish"}</Button>
        <Button size="sm" variant="outline" onClick={onArchive}><Archive className="h-3.5 w-3.5" /> Archive</Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}
