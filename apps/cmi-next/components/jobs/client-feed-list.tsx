"use client";

// The job's client activity list: selection comments, messages, texts, emails,
// warranty requests, finished action items and canvas briefs, newest first.
// Used on the Activity tab and in the floating "Client activity" slide-out.
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Layers, Loader2, Mail, MessageCircle, MessageSquare, Palette, ShieldAlert } from "lucide-react";
import { FEED_LABEL, type FeedItem, type FeedKind } from "@/lib/jobs/client-feed-core";
import { relTime } from "@/lib/selection-comments/thread";

const ICON: Record<FeedKind, React.ComponentType<{ className?: string }>> = {
  selection: Layers, message: MessageSquare, sms: MessageCircle, email: Mail, warranty: ShieldAlert, action_item: ClipboardCheck, canvas: Palette,
};

export function ClientFeedList({ jobId, onNavigate, onLoaded }: { jobId: string; onNavigate?: () => void; onLoaded?: (open: number) => void }) {
  const [items, setItems] = React.useState<FeedItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  const loaded = React.useRef(onLoaded);
  React.useEffect(() => { loaded.current = onLoaded; }, [onLoaded]);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/jobs/${jobId}/client-feed`).then(async (r) => {
      const j = await r.json();
      if (!live) return;
      if (!r.ok) { setError(j.error || "Could not load client activity."); setItems([]); return; }
      setItems(j.items ?? []);
      loaded.current?.(j.open ?? 0);
    }).catch(() => { if (live) { setError("Could not load client activity."); setItems([]); } });
    return () => { live = false; };
  }, [jobId]);

  if (items === null) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading client activity…</div>;
  const open = items.filter((i) => i.open).length;
  const shown = onlyOpen ? items.filter((i) => i.open) : items;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{open ? <><strong className="text-accent">{open} waiting on the team</strong> · </> : null}{items.length} from the client</p>
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 text-xs">
          <button type="button" onClick={() => setOnlyOpen(false)} className={`rounded px-2 py-1 ${!onlyOpen ? "bg-accent/15 font-medium text-accent" : "text-muted-foreground"}`}>All</button>
          <button type="button" onClick={() => setOnlyOpen(true)} className={`rounded px-2 py-1 ${onlyOpen ? "bg-accent/15 font-medium text-accent" : "text-muted-foreground"}`}>Needs reply</button>
        </div>
      </div>
      {error && <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{onlyOpen ? "Nothing is waiting on the team." : "Nothing from the client yet. Selection comments, portal messages, texts, emails and warranty requests show here."}</p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {shown.map((i) => {
            const Icon = ICON[i.kind];
            return (
              <li key={i.id}>
                <Link href={i.href} onClick={onNavigate} className={`flex gap-3 px-3 py-2.5 transition hover:bg-muted/40 ${i.open ? "bg-accent/5" : ""}`}>
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${i.open ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{i.who}</span>
                      <span>{FEED_LABEL[i.kind]}</span>
                      <span title={new Date(i.at).toLocaleString()}>{relTime(i.at)}</span>
                      {i.open && <span className="rounded-full bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">Needs reply</span>}
                    </div>
                    <div className="text-sm font-medium">{i.title}</div>
                    {i.body && <p className="line-clamp-2 break-words text-xs text-muted-foreground">{i.body}</p>}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
