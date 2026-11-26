"use client";

// Tools on the Overview: search, All features, the clock, the dialpad,
// recorder, notepad, a to-do list with reminders, Ask Bolt, quick links and
// admin shortcuts. (Echo's tools cards, for CMI.)
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Bell, Check, LayoutGrid, Loader2, Mic, Plus, Search, Send, Trash2 } from "lucide-react";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { featureCatalog, visibleFeatures } from "@/lib/features/catalog";
import type { SearchHit } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { Empty, Frame } from "../kit";

const BoltModal = dynamic(() => import("@/components/dashboard/bolt-modal").then((m) => m.BoltModal), { ssr: false });
const CallsWorkspace = dynamic(() => import("@/app/dashboard/communications/calls-workspace").then((m) => m.CallsWorkspace), { ssr: false });

type Set = (patch: Record<string, unknown>) => void;
const TZ = "America/Phoenix";
const inputCls = "w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";

// ── Search ─────────────────────────────────────────────────────────────────

export function SearchCard() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- clear stale results
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const j = (await r.json()) as { hits?: SearchHit[] };
        setHits(j.hits ?? []);
      } catch { setHits([]); } finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Frame bodyClassName="flex flex-col justify-center">
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs, contacts, deals, files and pages" aria-label="Search"
          className={cn(inputCls, "h-11 rounded-xl pl-10 pr-10 text-base")} />
        {busy ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : <ArrowRight className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      </div>
      {hits && (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {hits.length === 0 ? <li className="px-2 py-1.5 text-sm text-muted-foreground">No matches.</li> : hits.slice(0, 8).map((h) => (
            <li key={`${h.group}-${h.id}`}>
              <Link href={h.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 truncate">{h.title}{h.subtitle ? <span className="text-muted-foreground"> · {h.subtitle}</span> : null}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">{h.group}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function AllFeaturesCard({ open }: { open: () => void }) {
  return (
    <button type="button" onClick={open}
      className="group flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105"><LayoutGrid className="size-5" /></span>
      <span className="text-sm font-medium">All features</span>
    </button>
  );
}

// ── Clock ──────────────────────────────────────────────────────────────────

const noop = () => () => {};
function useNow(every = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(t);
  }, [every]);
  return mounted ? now ?? new Date() : null;
}

export function ClockCard() {
  const now = useNow(1000);
  return (
    <Frame bodyClassName="flex flex-col justify-center">
      {now ? (
        <>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{now.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}
            <span className="ml-1 text-sm font-normal tabular-nums text-muted-foreground">{String(now.getSeconds()).padStart(2, "0")}</span></p>
          <p className="text-sm text-muted-foreground">{now.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
        </>
      ) : <div className="h-14 animate-pulse rounded-lg bg-muted" />}
    </Frame>
  );
}

// ── Dialpad (desktop) ──────────────────────────────────────────────────────

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** The Communications softphone, compact. One per page: it rings with the office line. */
export function DialpadCard({ first }: { first: boolean }) {
  const wide = useWide();
  const meta = CARDS.dialpad;
  if (!first) return <Frame title={meta.title} icon={meta.icon}><Empty>You already have a dialpad on this dashboard.</Empty></Frame>;
  if (!wide) {
    return (
      <Frame title={meta.title} icon={meta.icon} href="/dashboard/communications?panel=dialer">
        <Empty action={<Link href="/dashboard/communications?panel=dialer" className="text-xs underline">Open the dialer</Link>}>The dialpad works on a computer.</Empty>
      </Frame>
    );
  }
  return (
    <Frame title={meta.title} icon={meta.icon} href="/dashboard/communications?panel=dialer">
      <p className="mb-2 text-xs text-muted-foreground">Calls go out on the CMI office line, which rings for everyone signed in.</p>
      <div className="max-h-[34rem] overflow-y-auto"><CallsWorkspace hideLog showStats={false} /></div>
    </Frame>
  );
}

// ── Recorder ───────────────────────────────────────────────────────────────

export function RecorderCard() {
  const meta = CARDS.recorder;
  return (
    <Frame title={meta.title} icon={meta.icon} href="/dashboard/recording-studio">
      <div className="grid gap-2">
        <Link href="/dashboard/recording-studio" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90">
          <Mic className="size-4" /> Record a meeting
        </Link>
        <p className="text-xs text-muted-foreground">Recordings are transcribed and summarized in Recording Studio.</p>
      </div>
    </Frame>
  );
}

// ── Notepad ────────────────────────────────────────────────────────────────

export function NotepadCard({ settings, set }: { settings?: Record<string, unknown>; set: Set }) {
  const [text, setText] = useState(String(settings?.text ?? ""));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ text: v.slice(0, 20000) }), 700);
  };
  return (
    <Frame title={String(settings?.title ?? "Notepad")} icon={CARDS.notepad.icon}>
      <textarea value={text} onChange={(e) => change(e.target.value)} placeholder="Jot something down. It saves as you type." aria-label="Notes"
        className="h-full min-h-36 w-full resize-none rounded-lg border-0 bg-amber-50/70 p-3 text-sm outline-none focus:ring-1 focus:ring-accent/40 dark:bg-amber-500/5" />
    </Frame>
  );
}

// ── To-do list with reminders ──────────────────────────────────────────────

type Todo = { id: string; text: string; done?: boolean; due?: string | null };

export function TaskListCard({ settings, set }: { settings?: Record<string, unknown>; set: Set }) {
  const items: Todo[] = useMemo(() => (Array.isArray(settings?.items) ? (settings!.items as Todo[]) : []), [settings]);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const now = useNow(30_000);
  const notified = useRef(new Set<string>());

  // A reminder whose time has come: a browser notification while the page is open.
  useEffect(() => {
    if (!now || typeof Notification === "undefined") return;
    for (const t of items) {
      if (t.done || !t.due || notified.current.has(t.id)) continue;
      if (Date.parse(t.due) <= now.getTime()) {
        notified.current.add(t.id);
        if (Notification.permission === "granted") new Notification("Reminder", { body: t.text });
      }
    }
  }, [now, items]);

  const save = (next: Todo[]) => set({ items: next.slice(0, 50) });
  const add = () => {
    const v = text.trim();
    if (!v) return;
    const dueIso = due ? new Date(`${due}:00-07:00`).toISOString() : null;
    if (dueIso && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    save([...items, { id: Math.random().toString(36).slice(2, 10), text: v.slice(0, 200), due: dueIso }]);
    setText(""); setDue("");
  };
  const open = items.filter((t) => !t.done).length;

  return (
    <Frame title={String(settings?.title ?? "To-do")} icon={CARDS.task_list.icon} action={<span className="text-xs text-muted-foreground">{open} open</span>}>
      <form className="mb-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" aria-label="New to-do" className={cn(inputCls, "h-9 flex-1")} />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Remind me at" title="Remind me at" className={cn(inputCls, "h-9 w-9 px-1 text-[0px] focus:w-44 focus:text-sm")} />
        <button type="submit" aria-label="Add" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted"><Plus className="size-4" /></button>
      </form>
      {!items.length ? <Empty>Nothing here yet.</Empty> : (
        <ul className="space-y-1">
          {items.map((t) => {
            const overdue = !t.done && t.due && now && Date.parse(t.due) <= now.getTime();
            return (
              <li key={t.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-muted/50">
                <button type="button" onClick={() => save(items.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label={t.done ? "Mark not done" : "Mark done"}
                  className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", t.done ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                  {t.done && <Check className="size-3" />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", t.done && "text-muted-foreground line-through")}>{t.text}</span>
                  {t.due && <span className={cn("inline-flex items-center gap-1 text-[11px]", overdue ? "font-medium text-amber-600" : "text-muted-foreground")}>
                    <Bell className="size-3" />{new Date(t.due).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>}
                </span>
                <button type="button" onClick={() => save(items.filter((x) => x.id !== t.id))} aria-label="Delete"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="size-3.5 text-muted-foreground" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}

// ── Ask Bolt ───────────────────────────────────────────────────────────────

export function AskBoltCard() {
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const ask = (text: string) => { if (text.trim()) { setAsking(text.trim()); setQ(""); } };
  return (
    <Frame title="Ask Bolt" icon={CARDS.ask_bolt.icon} href="/dashboard/agent">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What's due on my jobs this week? Which deals need a follow-up?" aria-label="Ask Bolt"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} className={cn(inputCls, "py-2")} />
        <div className="flex flex-wrap gap-1.5">
          {["What's due this week?", "Which deals need a touch?", "How do I add a job?"].map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">{s}</button>
          ))}
          <button type="submit" disabled={!q.trim()} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"><Send className="size-3.5" /> Ask</button>
        </div>
      </form>
      {asking && <BoltModal context="Overview" initialPrompt={asking} onClose={() => setAsking(null)} />}
    </Frame>
  );
}

// ── Quick links and admin shortcuts ────────────────────────────────────────

const QUICK = ["Jobs", "Pipeline", "Contacts", "Schedules", "Cloud", "Daily Logs", "Bookings", "Communications", "Punch Lists", "Workspace"];

export function QuickLinksCard({ data }: { data: DashboardData }) {
  const links = useMemo(() => {
    const all = visibleFeatures(featureCatalog(data.appUrl), data.role, data.flags);
    return QUICK.map((t) => all.find((f) => f.title === t && f.href)).filter(Boolean).slice(0, 8) as { title: string; href: string }[];
  }, [data.appUrl, data.role, data.flags]);
  return (
    <Frame title="Quick links" icon={CARDS.quick_links.icon}>
      <div className="grid grid-cols-2 gap-1.5">
        {links.map((l) => <Link key={l.href} href={l.href} className="truncate rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">{l.title}</Link>)}
      </div>
    </Frame>
  );
}

export function AdminShortcutsCard() {
  const links = [
    { href: "/dashboard/users", label: "Users" },
    { href: "/dashboard/settings?tab=features", label: "Feature flags" },
    { href: "/dashboard/settings?tab=claude", label: "Claude access" },
    { href: "/dashboard/settings?tab=credentials", label: "Integrations" },
    { href: "/dashboard/settings?tab=sidebar", label: "Sidebar" },
    { href: "/dashboard/messaging-consent", label: "Consent" },
  ];
  return (
    <Frame title="Admin shortcuts" icon={CARDS.admin_shortcuts.icon} href="/dashboard/settings">
      <div className="grid grid-cols-2 gap-1.5">
        {links.map((l) => <Link key={l.href} href={l.href} className="truncate rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">{l.label}</Link>)}
      </div>
    </Frame>
  );
}
