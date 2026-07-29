"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  Info,
  Mail,
  Menu,
  SquarePen,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { cn } from "@/lib/utils";

type NavLink = { label: string; href: string; description: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; flag?: string };

const DISCOVER: NavLink[] = [
  { label: "About Us", href: "/about", description: "Meet the CMI story and approach.", icon: Info },
  { label: "Our Team", href: "/team", description: "Builders, designers, and project leads.", icon: Users },
  { label: "Resources", href: "/resources", description: "Guides, project notes, and construction insight.", icon: BookOpen },
  { label: "Project Canvas", href: "/project-canvas", description: "Sketch your project right on photos of your space.", icon: SquarePen, flag: "project_canvas_public" },
  { label: "Contact", href: "/contact", description: "Start a conversation with the team.", icon: Mail },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    fetch("/api/flags").then((r) => r.json()).then((d: { flags?: Record<string, boolean> }) => setFlags(d.flags ?? {})).catch(() => {});
  }, []);
  const discover = DISCOVER.filter((i) => !i.flag || flags[i.flag] === true);
  // Split the mega menu into two balanced columns regardless of how many items
  // are visible (flags can hide some), so it never ends up lopsided (e.g. 3/1).
  const discoverRows = Math.max(1, Math.ceil(discover.length / 2));

  // Close on route change
  React.useEffect(() => { setMobileOpen(false); setOpenDropdown(null); }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-background/98 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/95">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to main content
      </a>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="Constructed Matter, Inc. — home">
          <img src="/brand/CMI_Line_Logo_Black.svg" alt="Constructed Matter, Inc." className="h-9 w-auto dark:hidden" />
          <img src="/brand/CMI_Line_Logo_White.svg" alt="" aria-hidden="true" className="hidden h-9 w-auto dark:block" />
        </Link>

        <nav className="hidden items-center gap-4 lg:flex" aria-label="Primary">
          <div className="relative" onMouseEnter={() => setOpenDropdown("discover")} onMouseLeave={() => setOpenDropdown(null)}>
            <button type="button" aria-expanded={openDropdown === "discover"} aria-haspopup="true" className={cn("flex items-center gap-1 border-b border-transparent px-3 py-6 text-sm font-semibold uppercase tracking-wide transition hover:text-accent", openDropdown === "discover" ? "border-accent text-accent" : "text-foreground/75")}>
              Discover <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", openDropdown === "discover" && "rotate-180")} />
            </button>
            {/* Two-column mega menu. Rows = half the visible items (rounded up)
                and column flow fills the first column before the second, so the
                two columns stay balanced no matter how many items are shown. */}
            {openDropdown === "discover" && (
              <div className="absolute left-0 top-full mt-0 w-[620px] rounded-xl border border-border bg-card p-4 shadow-2xl">
                <div className="grid grid-flow-col gap-x-3 gap-y-1" style={{ gridTemplateRows: `repeat(${discoverRows}, minmax(0, auto))` }}>
                  {discover.map((item) => (
                    <Link key={item.href} href={item.href} className={cn("flex gap-3 rounded-lg px-3 py-3 transition hover:bg-muted", isActive(item.href) ? "text-accent" : "text-muted-foreground hover:text-foreground")}>
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/services" className={cn("border-b border-transparent px-3 py-6 text-sm font-semibold uppercase tracking-wide transition hover:text-accent", isActive("/services") ? "border-accent text-accent" : "text-foreground/75")}>
            Services
          </Link>

          <Link href="/portfolio" className={cn("border-b border-transparent px-3 py-6 text-sm font-semibold uppercase tracking-wide transition hover:text-accent", isActive("/portfolio") ? "border-accent text-accent" : "text-foreground/75")}>
            Portfolio
          </Link>
          <Link href="/contact" className={cn("border-b border-transparent px-3 py-6 text-sm font-semibold uppercase tracking-wide transition hover:text-accent", isActive("/contact") ? "border-accent text-accent" : "text-foreground/75")}>
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/contact" className="hidden rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 lg:block">
            Let's Build Together
          </Link>
          <ThemeToggle />
          <button type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground lg:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-card lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-5 py-4">
            <MobileSection label="Discover" items={discover} />
            <Link href="/services" className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Services</Link>
            <Link href="/portfolio" className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Portfolio</Link>
            <Link href="/contact" className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Contact</Link>
            <div className="pt-3">
              <Link href="/contact" className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white">
                Let's Build Together
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileSection({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
        {label} <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">{item.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
