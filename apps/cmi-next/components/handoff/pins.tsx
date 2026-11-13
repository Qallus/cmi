"use client";

// Pins (one home per project, Step 2).
//   <PinnedStrip area="precon" />   the "Pinned here" cards at the top of a board.
//     They open the real record, can't be dragged, and aren't in the board's
//     counts or totals (the board's own records are the only ones counted).
//   <PinControl recordType="job" recordId={…} />   "Also show in…" on a record.
// Any CMI staff member can pin. Before the migration runs, both stay hidden.
import * as React from "react";
import Link from "next/link";
import { Pin, PinOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AREA_LABEL, type Area } from "@/lib/handoff/home";
import { otherAreas, type PinRecordType } from "@/lib/handoff/pins-core";
import type { PinnedCard } from "@/lib/handoff/pins";

const STATUS = (s: string | null) => (s ? s.replace(/_/g, " ") : "");

export function PinnedStrip({ area, className }: { area: Area; className?: string }) {
  const [cards, setCards] = React.useState<PinnedCard[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    const load = () => {
      void fetch(`/api/pins?area=${area}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (live && d) setCards(d.cards ?? []); })
        .catch(() => {});
    };
    load();
    // Another part of the page pinned or unpinned something.
    window.addEventListener("cmi:pins-changed", load);
    return () => { live = false; window.removeEventListener("cmi:pins-changed", load); };
  }, [area]);

  async function remove(c: PinnedCard) {
    setBusy(c.pin_id);
    const r = await fetch(`/api/pins?id=${c.pin_id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) setCards((cur) => cur.filter((x) => x.pin_id !== c.pin_id));
  }

  if (!cards.length) return null;
  return (
    <div className={cn("rounded-lg border border-dashed border-accent/40 bg-accent/5 p-2", className)}>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Pin className="h-3 w-3" /> Pinned here <span className="font-normal normal-case tracking-normal">· they live in another area and aren&apos;t counted in this board&apos;s totals</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {cards.map((c) => (
          <div key={c.pin_id} className="flex w-64 shrink-0 items-start gap-2 rounded-md border border-border bg-card p-2 text-sm shadow-xs">
            <Link href={c.href} className="min-w-0 flex-1" title={c.note ?? `Pinned${c.pinned_by_name ? ` by ${c.pinned_by_name}` : ""}`}>
              <div className="truncate font-medium leading-tight hover:underline">{c.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {c.number ? <span className="truncate font-mono">{c.number}</span> : null}
                <span className="shrink-0 rounded bg-accent/15 px-1.5 py-px font-medium text-accent">In {c.homeLabel}</span>
                <span className="truncate capitalize">{STATUS(c.status)}</span>
              </div>
            </Link>
            <button type="button" onClick={() => void remove(c)} disabled={busy === c.pin_id} aria-label={`Unpin ${c.title}`} title="Unpin from this board"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
              {busy === c.pin_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PinOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PinControl({ recordType, recordId, className }: { recordType: PinRecordType; recordId: string; className?: string }) {
  const [pins, setPins] = React.useState<{ id: string; show_in: Area }[] | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<Area | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    void fetch(`/api/pins?record_type=${recordType}&record_id=${recordId}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!live) return;
      if (r.ok) { setPins(d.pins ?? []); setMissing(!!d.missing); }
    });
    return () => { live = false; };
  }, [recordType, recordId]);

  if (missing || !pins) return null;
  const pinned = (a: Area) => pins.find((p) => p.show_in === a);

  async function toggle(a: Area) {
    setBusy(a); setError(null);
    const p = pinned(a);
    const r = p
      ? await fetch(`/api/pins?id=${p.id}`, { method: "DELETE" })
      : await fetch("/api/pins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: recordType, record_id: recordId, show_in: a }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(d.error ?? "Could not change the pin."); return; }
    const fresh = await fetch(`/api/pins?record_type=${recordType}&record_id=${recordId}`).then((x) => x.json()).catch(() => ({ pins: pins }));
    setPins(fresh.pins ?? []);
    window.dispatchEvent(new Event("cmi:pins-changed"));
  }

  const count = pins.length;
  return (
    <div className={cn("relative", className)}>
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        title={count ? `Also shown in ${pins.map((p) => AREA_LABEL[p.show_in]).join(" and ")}` : "Also show this project on another board"}>
        <Pin className={cn("h-3.5 w-3.5", count && "fill-current text-accent")} /> {count ? `Pinned (${count})` : "Pin"}
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Also show in…</div>
            {otherAreas(recordType).map((a) => (
              <button key={a} type="button" onClick={() => void toggle(a)} disabled={busy !== null}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50 disabled:opacity-60">
                <span className={cn("grid h-4 w-4 place-items-center rounded border", pinned(a) ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                  {busy === a ? <Loader2 className="h-3 w-3 animate-spin" /> : pinned(a) ? <Check className="h-3 w-3" /> : null}
                </span>
                {AREA_LABEL[a]}
              </button>
            ))}
            <p className="px-2 pb-1 pt-1 text-[11px] text-muted-foreground">It stays in its own area; a pin adds a card at the top of the other board, left out of its totals.</p>
            {error ? <p className="px-2 pb-1 text-[11px] text-destructive">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
