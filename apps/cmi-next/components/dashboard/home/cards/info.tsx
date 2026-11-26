"use client";

// Get started and What's new: tiles in one row that slides sideways. Any tile
// can be hidden (and brought back) from the card itself. (From Echo.)
import Link from "next/link";
import {
  Bot, CalendarDays, Cloud, Eye, FileText, HardHat, IdCard, LayoutGrid, Megaphone, PartyPopper, Plug, Rocket, Sparkles, User, WandSparkles, Workflow, X,
  type LucideIcon,
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";
import { SlideRow } from "../slide-row";

type Set = (patch: Record<string, unknown>) => void;
type Tile = { id: string; icon: LucideIcon; title: string; desc: string; href?: string; action?: () => void; tag?: string | null };

function Tiles({ tiles, settings, set, empty }: { tiles: Tile[]; settings?: Record<string, unknown>; set: Set; empty: string }) {
  const hidden = Array.isArray(settings?.hidden) ? (settings!.hidden as string[]) : [];
  const shown = tiles.filter((t) => !hidden.includes(t.id));
  const hide = (id: string) => set({ hidden: [...hidden, id] });
  return (
    <div className="space-y-2">
      {shown.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p> : (
        <SlideRow label="Tiles">
          {shown.map((t) => {
            const body = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><t.icon className="size-5" /></span>
                <span className="min-w-0 pr-5">
                  <span className="flex items-center gap-2 font-medium">{t.title}{t.tag ? <span className="rounded border border-border px-1 text-[10px] font-normal text-muted-foreground">{t.tag}</span> : null}</span>
                  <span className="mt-0.5 line-clamp-3 block text-sm text-muted-foreground">{t.desc}</span>
                </span>
              </>
            );
            const cls = cn("relative flex h-full w-[17rem] shrink-0 snap-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm sm:w-[19rem]",
              (t.href || t.action) && "transition-colors hover:bg-muted/50");
            return (
              <div key={t.id} className="group relative shrink-0">
                {t.href ? <Link href={t.href} className={cls}>{body}</Link> : t.action ? <button type="button" onClick={t.action} className={cls}>{body}</button> : <div className={cls}>{body}</div>}
                <button type="button" onClick={() => hide(t.id)} aria-label={`Hide ${t.title}`} title="Hide"
                  className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100">
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </SlideRow>
      )}
      {hidden.length > 0 && (
        <button type="button" onClick={() => set({ hidden: [] })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Eye className="size-3.5" /> Show {hidden.length} hidden
        </button>
      )}
    </div>
  );
}

export function GetStartedCard({ settings, set, openFeatures, customize }: { settings?: Record<string, unknown>; set: Set; openFeatures: () => void; customize: () => void }) {
  const tiles: Tile[] = [
    { id: "customize", icon: WandSparkles, title: "Make this dashboard yours", desc: "Move, resize and hide cards, or add new ones: tasks, calendar, dialpad, notepad and charts.", action: customize },
    { id: "features", icon: LayoutGrid, title: "Explore all features", desc: "Everything CMI can do, and where to find it, in one panel.", action: openFeatures },
    { id: "profile", icon: User, title: "Finish your profile", desc: "Your photo, phone and notification preferences.", href: "/dashboard/my-profile" },
    { id: "card", icon: IdCard, title: "Create your business card", desc: "A digital card you share by link or QR. People who save it become leads.", href: "/dashboard/business-cards" },
    { id: "claude", icon: Plug, title: "Connect Claude", desc: "Use CMI from Claude: jobs, deals, schedules and files. Steps are in All features.", action: openFeatures },
    { id: "bolt", icon: Bot, title: "Ask Bolt", desc: "Ask how anything works, or have Bolt update a job, deal or schedule for you.", href: "/dashboard/agent" },
  ];
  return <Tiles tiles={tiles} settings={settings} set={set} empty="All Get started tiles are hidden." />;
}

const FALLBACK_NEWS: Tile[] = [
  { id: "events", icon: PartyPopper, title: "Event invitations", desc: "Animated invitation pages with RSVPs, +1s and a guest list. Bookings → Events.", href: "/dashboard/events" },
  { id: "dashboard", icon: LayoutGrid, title: "Your dashboard, your way", desc: "Drag cards into place, hide what you don't need, and add tools from Add card.", href: "/dashboard/overview" },
  { id: "claude", icon: Plug, title: "Claude connector", desc: "Work with CMI from Claude, with a confirmation before anything is sent.", href: "/dashboard/agent" },
];

// Icons a What's New entry can name (kept short so the page stays light).
export const NEWS_ICONS: Record<string, LucideIcon> = {
  Sparkles, Rocket, Megaphone, PartyPopper, CalendarDays, Cloud, FileText, HardHat, Workflow, Bot, Plug, LayoutGrid,
};
function iconFor(name: string | null): LucideIcon {
  return (name && NEWS_ICONS[name]) || Sparkles;
}

export function WhatsNewCard({ data, settings, set }: { data: DashboardData; settings?: Record<string, unknown>; set: Set }) {
  const tiles: Tile[] = data.whatsNew.length
    ? data.whatsNew.map((w) => ({ id: w.id, icon: iconFor(w.icon), title: w.title, desc: w.body, href: w.href ?? undefined, tag: w.tag }))
    : FALLBACK_NEWS;
  return <Tiles tiles={tiles} settings={settings} set={set} empty="Nothing new to show." />;
}
