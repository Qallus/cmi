"use client";

// Client-portal navigation, built like the dashboard's:
//   desktop  a left sidebar with the project's pages, grouped
//   phone    a hamburger (full-screen menu) and a fixed footer bar that
//            scrolls sideways through every page, and can be tucked away
// The project layout tells the shell which pages this client can see, and the
// shell remembers that project (per client, on this device) so its pages stay
// in every menu on every portal page: My Projects, Notifications, Settings and
// Canvas included. The portal's own pages are listed after the project's.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Calendar, CalendarCheck, Camera, CheckSquare, ChevronDown, ChevronUp, ClipboardList, DollarSign, FileText, FolderKanban,
  House, ListChecks, MessageCircle, Newspaper, Settings, ShieldCheck, SquarePen, TrendingUp, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PortalTab = { slug: string; label: string };
type Item = { href: string; label: string; icon: LucideIcon };

const ICON: Record<string, LucideIcon> = {
  overview: House, updates: Newspaper, messages: MessageCircle, selections: CheckSquare, "change-orders": FileText,
  "action-items": ListChecks, progress: TrendingUp, schedule: Calendar, milestones: CalendarCheck, "punch-list": ClipboardList,
  photos: Camera, documents: FolderKanban, financials: DollarSign, warranty: ShieldCheck,
};
// Sidebar groups, in order. A page shows only when the client may see it.
const GROUPS: { label: string | null; slugs: string[] }[] = [
  { label: null, slugs: ["overview"] },
  { label: "Activity", slugs: ["updates", "messages"] },
  { label: "Decisions", slugs: ["selections", "change-orders", "action-items"] },
  { label: "Build", slugs: ["progress", "schedule", "milestones", "punch-list"] },
  { label: "Files", slugs: ["photos", "documents"] },
  { label: "Money", slugs: ["financials"] },
  { label: "After move-in", slugs: ["warranty"] },
];
const HOME_LABEL: Record<string, string> = { overview: "Home" };

type JobNav = { jobId: string; jobName: string; tabs: PortalTab[] } | null;
const Ctx = React.createContext<{ job: JobNav; setJob: (j: JobNav) => void; canvas: boolean }>({ job: null, setJob: () => {}, canvas: false });

const lastJobKey = (contactId: string) => `cmi.client.lastjob.${contactId}`;

export function PortalNavProvider({ canvas, contactId, children }: { canvas: boolean; contactId: string | null; children: React.ReactNode }) {
  const [job, setJobState] = React.useState<JobNav>(null);
  // The last project this client opened on this device, until a project page says otherwise.
  React.useEffect(() => {
    if (!contactId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(lastJobKey(contactId)) ?? "null") as JobNav;
      // eslint-disable-next-line -- one-time restore from this device
      if (saved?.jobId && Array.isArray(saved.tabs)) setJobState((cur) => cur ?? saved);
    } catch { /* storage blocked */ }
  }, [contactId]);
  const setJob = React.useCallback((j: JobNav) => {
    setJobState(j);
    if (contactId && j) { try { localStorage.setItem(lastJobKey(contactId), JSON.stringify(j)); } catch { /* storage blocked */ } }
  }, [contactId]);
  return <Ctx.Provider value={{ job, setJob, canvas }}>{children}</Ctx.Provider>;
}

function jobItems(job: NonNullable<JobNav>): Item[] {
  const base = `/client/jobs/${job.jobId}`;
  const allowed = new Map(job.tabs.map((t) => [t.slug, t.label]));
  return GROUPS.flatMap((g) => g.slugs).filter((s) => allowed.has(s))
    .map((s) => ({ href: s === "overview" ? base : `${base}/${s}`, label: HOME_LABEL[s] ?? allowed.get(s)!, icon: ICON[s] ?? House }));
}
function portalItems(canvas: boolean): Item[] {
  return [
    { href: "/client/jobs", label: "My Projects", icon: House },
    { href: "/client/notifications", label: "Notifications", icon: Bell },
    ...(canvas ? [{ href: "/client/canvas", label: "Canvas", icon: SquarePen }] : []),
    { href: "/client/settings", label: "Settings", icon: Settings },
  ];
}
function useActive() {
  const pathname = usePathname();
  return (href: string) => {
    // My Projects and a project's Home are only active on exactly that page.
    if (href === "/client/jobs" || /^\/client\/jobs\/[^/]+$/.test(href)) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

/** A project page (or My Projects, for a client's only project) sets the project the menus are for. */
export function RegisterJobNav({ jobId, jobName, tabs }: { jobId: string; jobName: string; tabs: PortalTab[] }) {
  const { setJob } = React.useContext(Ctx);
  const key = tabs.map((t) => t.slug).join(",");
  React.useEffect(() => {
    setJob({ jobId, jobName, tabs });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tabs change only with `key`
  }, [jobId, jobName, key, setJob]);
  return null;
}

/** True when the shell knows a project (so pages can leave room for the sidebar). */
export function useHasJobNav() { return !!React.useContext(Ctx).job; }

/** Desktop: the project's pages down the left, grouped, then the portal's own
 *  pages. Pulled left by the links' padding so the icons and labels line up
 *  with the logo above. */
export function PortalSidebar() {
  const { job, canvas } = React.useContext(Ctx);
  const isActive = useActive();
  const link = (it: Item) => {
    const on = isActive(it.href);
    return (
      <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined}
        className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition", on ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
        <it.icon className="h-4 w-4 shrink-0" />{it.label}
      </Link>
    );
  };
  const label = (text: string) => <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{text}</div>;
  return (
    <nav aria-label="Portal" className="sticky top-[5.5rem] -ml-3 hidden self-start lg:block">
      {job ? (
        <>
          <div className="mb-3 truncate px-3 text-xs font-semibold text-foreground">{job.jobName}</div>
          {GROUPS.map((g) => {
            const items = jobItems(job).filter((it) => g.slugs.some((s) => it.href.endsWith(s === "overview" ? job.jobId : `/${s}`)));
            if (!items.length) return null;
            return <div key={g.label ?? "home"} className="mb-4">{g.label ? label(g.label) : null}{items.map(link)}</div>;
          })}
        </>
      ) : null}
      <div className="mb-4 border-t border-border pt-4 first:border-0 first:pt-0">{label("Portal")}{portalItems(canvas).map(link)}</div>
    </nav>
  );
}

/** Phone / tablet: full-screen menu behind the hamburger. */
export function PortalMobileMenu({ open, onClose, footer }: { open: boolean; onClose: () => void; footer: React.ReactNode }) {
  const { job, canvas } = React.useContext(Ctx);
  const isActive = useActive();
  const pathname = usePathname();
  React.useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close on navigation
  if (!open) return null;
  const row = (it: Item) => (
    <Link key={it.href} href={it.href} className={cn("flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-[15px] font-medium", isActive(it.href) ? "bg-accent/10 text-accent" : "text-foreground hover:bg-muted")}>
      <it.icon className="h-5 w-5 shrink-0 text-muted-foreground" />{it.label}
    </Link>
  );
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
          <img src="/brand/CMI_Line_Logo_Black.svg" alt="Constructed Matter, Inc." className="h-8 w-auto object-contain dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/CMI_Line_Logo_White.svg" alt="" aria-hidden className="hidden h-8 w-auto object-contain dark:block" />
          <div className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Client Project Portal</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {job ? (
          <>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{job.jobName}</div>
            <div className="mb-4 space-y-0.5">{jobItems(job).map(row)}</div>
          </>
        ) : null}
        <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Portal</div>
        <div className="space-y-0.5">{portalItems(canvas).map(row)}</div>
      </div>
      <div className="shrink-0 border-t border-border p-3">{footer}</div>
    </div>
  );
}

const FOOTER_KEY = "cmi_client_footer_closed";

/** Phone / tablet: fixed footer that scrolls sideways through every page; tuck it away to a "Menu" pill. */
export function PortalFooterNav() {
  const { job, canvas } = React.useContext(Ctx);
  const isActive = useActive();
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => {
    // eslint-disable-next-line -- one-time restore of the tucked-away state
    try { if (localStorage.getItem(FOOTER_KEY) === "1") setOpen(false); } catch { /* storage blocked */ }
  }, []);
  const persist = (v: boolean) => { setOpen(v); try { localStorage.setItem(FOOTER_KEY, v ? "0" : "1"); } catch { /* storage blocked */ } };
  const items = [...(job ? jobItems(job) : []), ...portalItems(canvas)];
  // A tab on the bar's top edge, left: "Hide" tucks the bar away and leaves
  // the same tab docked at the bottom as "Show".
  const tab = "inline-flex items-center gap-1 rounded-t-lg border border-b-0 border-border bg-card/95 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition hover:text-foreground";
  if (!open) {
    return (
      <div className="fixed bottom-0 left-3 z-40 lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button type="button" onClick={() => persist(true)} aria-label="Show the page menu" className={cn(tab, "shadow-[0_-2px_10px_rgba(0,0,0,0.08)]")}>
          <ChevronUp className="h-3.5 w-3.5" /> Show
        </button>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <button type="button" onClick={() => persist(false)} aria-label="Hide the page menu" className={cn(tab, "absolute -top-[26px] left-3")}>
        <ChevronDown className="h-3.5 w-3.5" /> Hide
      </button>
      <div className="flex items-stretch border-t border-border bg-card/95 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
        <nav aria-label="Pages" className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => (
            <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
              className={cn("flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition", isActive(it.href) ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <it.icon className="h-5 w-5" />{it.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="bg-card/95" style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
