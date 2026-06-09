"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICES = [
  { label: "Residential",                      href: "/services/residential" },
  { label: "Commercial",                        href: "/services/commercial" },
  { label: "ADU",                               href: "/services/adu" },
  { label: "Renovations & Additions",           href: "/services/renovations-additions" },
  { label: "Architectural & Design Coordination", href: "/services/architectural-design" },
  { label: "New Construction",                  href: "/services/new-construction" },
];

const DISCOVER = [
  { label: "About Us",  href: "/about" },
  { label: "Our Team",  href: "/team" },
  { label: "Resources", href: "/resources" },
  { label: "Contact",   href: "/contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  // Close on route change
  React.useEffect(() => { setMobileOpen(false); setOpenDropdown(null); }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <img src="https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/CMI_Logo.svg" alt="Constructed Matter, Inc." className="h-9 w-auto dark:hidden" />
          <img src="https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/CMI_Logo_White.svg" alt="Constructed Matter, Inc." className="hidden h-9 w-auto dark:block" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {/* Discover dropdown */}
          <div className="relative" onMouseEnter={() => setOpenDropdown("discover")} onMouseLeave={() => setOpenDropdown(null)}>
            <button type="button" className={cn("flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition hover:text-foreground", openDropdown === "discover" ? "text-foreground" : "text-muted-foreground")}>
              Discover <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openDropdown === "discover" && "rotate-180")} />
            </button>
            {openDropdown === "discover" && (
              <div className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-border bg-card py-1.5 shadow-xl">
                {DISCOVER.map((item) => (
                  <Link key={item.href} href={item.href} className={cn("block px-4 py-2 text-sm transition hover:bg-muted", isActive(item.href) ? "text-accent" : "text-muted-foreground hover:text-foreground")}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Services dropdown */}
          <div className="relative" onMouseEnter={() => setOpenDropdown("services")} onMouseLeave={() => setOpenDropdown(null)}>
            <button type="button" className={cn("flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition hover:text-foreground", openDropdown === "services" || isActive("/services") ? "text-foreground" : "text-muted-foreground")}>
              Services <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openDropdown === "services" && "rotate-180")} />
            </button>
            {openDropdown === "services" && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-border bg-card py-1.5 shadow-xl">
                <Link href="/services" className="block border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent hover:bg-muted">All Services</Link>
                {SERVICES.map((item) => (
                  <Link key={item.href} href={item.href} className={cn("block px-4 py-2 text-sm transition hover:bg-muted", isActive(item.href) ? "text-accent" : "text-muted-foreground hover:text-foreground")}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/portfolio" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", isActive("/portfolio") ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Portfolio
          </Link>
          <Link href="/contact" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", isActive("/contact") ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Contact
          </Link>
        </nav>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-3">
          <Link href="/contact" className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 lg:block">
            Let's Build Together
          </Link>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground lg:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
