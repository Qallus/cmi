"use client";

// Job navigation in the client portal. On tablets and desktops, a row of tabs.
// On phones, a bottom bar (Home · Messages · Decisions · Photos · More), where
// More opens a sheet with every tab the client can see.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, CheckSquare, House, LayoutGrid, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { slug: string; label: string };

export function ClientJobNav({ jobId, tabs }: { jobId: string; tabs: Tab[] }) {
  const pathname = usePathname();
  const [more, setMore] = React.useState(false);
  const base = `/client/jobs/${jobId}`;
  const hrefOf = (slug: string) => (slug === "overview" ? base : `${base}/${slug}`);
  const isActive = (slug: string) => (slug === "overview" ? pathname === base : pathname === hrefOf(slug) || pathname.startsWith(`${hrefOf(slug)}/`));
  const has = (slug: string) => tabs.some((t) => t.slug === slug);

  // The phone bar: the most-used places, then More.
  const decisions = has("selections") ? "selections" : "action-items";
  const bar = [
    { slug: "overview", label: "Home", icon: House },
    ...(has("messages") ? [{ slug: "messages", label: "Messages", icon: MessageCircle }] : []),
    { slug: decisions, label: "Decisions", icon: CheckSquare },
    ...(has("photos") ? [{ slug: "photos", label: "Photos", icon: Camera }] : []),
  ];
  const inBar = new Set(bar.map((b) => b.slug));
  const moreActive = tabs.some((t) => !inBar.has(t.slug) && isActive(t.slug));

  return (
    <>
      <div className="hidden gap-1 overflow-x-auto border-b border-border sm:flex">
        {tabs.map((t) => (
          <Link key={t.slug} href={hrefOf(t.slug)}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition", isActive(t.slug) ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* Phone: where you are, then the bottom bar. */}
      <div className="text-sm font-semibold sm:hidden">{tabs.find((t) => isActive(t.slug))?.label ?? ""}</div>
      <nav aria-label="Project" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${bar.length + 1}, minmax(0, 1fr))` }}>
          {bar.map((b) => (
            <Link key={b.slug} href={hrefOf(b.slug)} onClick={() => setMore(false)}
              className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive(b.slug) ? "text-accent" : "text-muted-foreground")}>
              <b.icon className="h-5 w-5" />{b.label}
            </Link>
          ))}
          <button type="button" onClick={() => setMore((o) => !o)} aria-expanded={more}
            className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", more || moreActive ? "text-accent" : "text-muted-foreground")}>
            <LayoutGrid className="h-5 w-5" />More
          </button>
        </div>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your project</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabs.map((t) => (
                <Link key={t.slug} href={hrefOf(t.slug)} onClick={() => setMore(false)}
                  className={cn("flex min-h-[44px] items-center rounded-lg border px-3 text-sm font-medium", isActive(t.slug) ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
