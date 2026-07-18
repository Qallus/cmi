"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Cloud, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoltPanel } from "./bolt-panel";
import { CanvasStage } from "./canvas-stage";
import { SceneStrip } from "./scene-strip";
import { Toolbar } from "./toolbar";
import { useCanvasStore, type Surface } from "./use-canvas-store";

export function CanvasEditor({ canvasId, surface, backHref }: { canvasId: string; surface: Surface; backHref: string }) {
  const store = useCanvasStore(canvasId, surface);
  const [boltOpen, setBoltOpen] = React.useState(false);

  if (store.loading) {
    return <div className="flex h-[60vh] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (store.error && !store.canvas) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-destructive">{store.error}</p>
        <Link href={backHref} className="text-sm text-accent">← Back to canvases</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--stack,0px))] min-h-0 flex-col p-4 md:p-6">
      {/* Title row */}
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={backHref} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Project Canvas</span>
          </div>
          <input
            value={store.canvas?.title ?? ""}
            onChange={(e) => store.rename(e.target.value)}
            disabled={store.readOnly}
            aria-label="Canvas title"
            className="mt-1 w-full max-w-xl truncate bg-transparent font-display text-2xl font-semibold tracking-tight outline-none disabled:cursor-default"
          />
          <div className="mt-0.5 text-xs text-muted-foreground">{store.scenes.length} scene{store.scenes.length === 1 ? "" : "s"}</div>
        </div>
        <SavePill status={store.saveStatus} readOnly={store.readOnly} />
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-sm">
            <Toolbar store={store} />
            <CanvasStage store={store} />
          </div>
          <SceneStrip store={store} />
          {store.error && <div className="mt-2 text-xs text-destructive">{store.error}</div>}
        </div>

        {/* Bolt panel — desktop right column */}
        <aside className="hidden w-[320px] shrink-0 overflow-hidden rounded-xl border border-border bg-card xl:flex">
          <BoltPanel store={store} className="w-full" />
        </aside>
      </div>

      {/* Bolt — mobile floating button + bottom sheet */}
      <button type="button" onClick={() => setBoltOpen(true)} aria-label="Ask Bolt"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-accent to-amber-400 text-white shadow-lg xl:hidden">
        <Sparkles className="h-5 w-5" />
      </button>
      {boltOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end xl:hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setBoltOpen(false)} />
          <div className="relative z-10 flex h-[82vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <button type="button" onClick={() => setBoltOpen(false)} className="rounded p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <BoltPanel store={store} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function SavePill({ status, readOnly }: { status: "idle" | "saving" | "saved" | "error"; readOnly: boolean }) {
  if (readOnly) return <span className="whitespace-nowrap rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Read only</span>;
  const map = {
    idle: { icon: Cloud, text: "Auto-save on", cls: "text-muted-foreground bg-muted" },
    saving: { icon: Loader2, text: "Saving…", cls: "text-[#2e7d5b] bg-[#2e7d5b]/10" },
    saved: { icon: Check, text: "Auto-saved", cls: "text-[#2e7d5b] bg-[#2e7d5b]/10" },
    error: { icon: Cloud, text: "Save failed", cls: "text-destructive bg-destructive/10" },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold", map.cls)}>
      <Icon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} />{map.text}
    </span>
  );
}
