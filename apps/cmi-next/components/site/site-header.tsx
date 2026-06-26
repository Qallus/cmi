"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ClipboardList,
  DraftingCompass,
  Home,
  Info,
  Mail,
  Menu,
  Newspaper,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { cn } from "@/lib/utils";

const SERVICES = [
  { label: "Residential", href: "/services/residential", description: "Custom homes built with precision and care.", icon: Home },
  { label: "Commercial", href: "/services/commercial", description: "Functional spaces for modern business.", icon: Building2 },
  { label: "ADU", href: "/services/adu", description: "Accessory dwelling units, turnkey solutions.", icon: BriefcaseBusiness },
  { label: "Renovations and Additions", href: "/services/renovations-additions", description: "End-to-end oversight and coordination.", icon: ClipboardList },
  { label: "Architectural and Design Coordination", href: "/services/architectural-design", description: "Curated interiors that inspire.", icon: DraftingCompass },
  { label: "New Construction", href: "/services/new-construction", description: "Ground-up builds, start to finish.", icon: Building2 },
];

const DISCOVER = [
  { label: "About Us", href: "/about", description: "Meet the CMI story and approach.", icon: Info },
  { label: "Our Team", href: "/team", description: "Builders, designers, and project leads.", icon: Users },
  { label: "Resources", href: "/resources", description: "Guides, project notes, and construction insight.", icon: BookOpen },
  { label: "Blog", href: "/blog", description: "Fresh updates from the CMI team.", icon: Newspaper },
  { label: "Contact", href: "/contact", description: "Start a conversation with the team.", icon: Mail },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

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
            {openDropdown === "discover" && (
              <div className="absolute left-0 top-full mt-0 w-80 rounded-xl border border-border bg-card p-3 shadow-2xl">
                {DISCOVER.map((item) => (
                  <Link key={item.href} href={item.href} className={cn("flex gap-3 rounded-lg px-3 py-3 transition hover:bg-muted", isActive(item.href) ? "text-accent" : "text-muted-foreground hover:text-foreground")}>
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative" onMouseEnter={() => setOpenDropdown("services")} onMouseLeave={() => setOpenDropdown(null)}>
            <button type="button" aria-expanded={openDropdown === "services"} aria-haspopup="true" className={cn("flex items-center gap-1 border-b border-transparent px-3 py-6 text-sm font-semibold uppercase tracking-wide transition hover:text-accent", openDropdown === "services" || isActive("/services") ? "border-accent text-accent" : "text-foreground/75")}>
              Services <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", openDropdown === "services" && "rotate-180")} />
            </button>
            {openDropdown === "services" && (
              <div className="absolute left-1/2 top-full mt-0 w-[720px] -translate-x-1/2 rounded-xl border border-border bg-card p-7 shadow-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Our Services</div>
                <div className="mt-7 grid grid-cols-3 gap-x-8 gap-y-10">
                  {SERVICES.map((item) => (
                    <Link key={item.href} href={item.href} className={cn("group flex gap-3", isActive(item.href) ? "text-accent" : "text-foreground")}>
                      <item.icon className="mt-1 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                      <span>
                        <span className="block text-base font-semibold leading-snug transition group-hover:text-accent">{item.label}</span>
                        <span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                  <span className="text-sm text-muted-foreground">Not sure where to start?</span>
                  <Link href="/contact" className="text-sm font-semibold text-accent transition hover:text-accent/80">Let's Build Together -&gt;</Link>
                </div>
              </div>
            )}
          </div>

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
            <MobileSection label="Discover" items={DISCOVER} />
            <MobileSection label="Services" items={[{ label: "All Services", href: "/services" }, ...SERVICES]} />
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
