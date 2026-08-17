"use client";

import * as React from "react";
import { Bell, CalendarClock, Check, FileText, Loader2, Mail, Megaphone, MessageSquare, MessagesSquare, StickyNote, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "@/components/pwa/push-toggle";

type Kind = "submission" | "message" | "lead" | "note" | "booking" | "dm" | "broadcast" | "note_link" | "schedule";
type Item = { id: string; kind: Kind; title: string; subtitle: string; time: string; href: string };

const ICON: Record<Kind, React.ComponentType<{ className?: string }>> = {
  submission: FileText,
  message: MessageSquare,
  lead: UserPlus,
  note: StickyNote,
  booking: CalendarClock,
  dm: MessagesSquare,
  broadcast: Megaphone,
  note_link: StickyNote,
  schedule: CalendarClock,
};
const ICON_TONE: Record<Kind, string> = {
  submission: "bg-info/15 text-info",
  message: "bg-accent/15 text-accent",
  lead: "bg-success/15 text-success",
  note: "bg-warning/15 text-warning",
  booking: "bg-accent/15 text-accent",
  dm: "bg-info/15 text-info",
  broadcast: "bg-accent/15 text-accent",
  note_link: "bg-warning/15 text-warning",
  schedule: "bg-accent/15 text-accent",
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const loadCount = React.useCallback(() => {
    fetch("/api/notifications/unread-count")
      .then((r) => r.json())
      .then((d: { count?: number }) => setCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  const loadItems = React.useCallback(() => {
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d: { items?: Item[]; count?: number }) => {
        setItems(d.items ?? []);
        setCount(d.count ?? (d.items?.length ?? 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll the badge count on an interval (cheap head-count endpoint).
  React.useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [loadCount]);

  // Load the full list whenever the dropdown opens.
  React.useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  async function markRead(item: Item) {
    setBusyId(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setCount((c) => Math.max(0, c - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
    } catch { /* optimistic — badge refreshes on next poll */ }
    finally { setBusyId(null); }
  }

  async function openItem(item: Item) {
    // Mark read, then navigate to where the item lives.
    await markRead(item);
    setOpen(false);
    router.push(item.href);
  }

  async function markAll() {
    const snapshot = items;
    setItems([]);
    setCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch { setItems(snapshot); loadCount(); }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:text-foreground",
          open && "text-foreground",
        )}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="text-sm font-semibold">
              Notifications{count > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{count} new</span>}
            </div>
            {items.length > 0 && (
              <button type="button" onClick={() => void markAll()} className="text-xs font-medium text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-muted"><Mail className="h-5 w-5 text-muted-foreground" /></div>
                <div className="text-sm font-medium">You&apos;re all caught up</div>
                <div className="text-xs text-muted-foreground">New submissions, messages, leads, and notes show up here.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const Icon = ICON[item.kind] ?? Bell;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="group relative flex items-start gap-3 px-4 py-3 transition hover:bg-muted/40">
                      <button type="button" onClick={() => void openItem(item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", ICON_TONE[item.kind])}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          {item.subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{relTime(item.time)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void markRead(item)}
                        disabled={busyId === item.id}
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border bg-muted/20">
            <PushToggle />
          </div>
        </div>
      )}
    </div>
  );
}
