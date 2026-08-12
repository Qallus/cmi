"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Camera, ChevronUp, HardHat, Home, IdCard, Mail, Mic, Package, Phone, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Fixed, horizontally-scrollable quick-nav for mobile/tablet. Dismissable, with
// the closed state remembered. Hidden on desktop (the sidebar covers that) and
// in print.
const ITEMS: { href: string; label: string; icon: typeof Home }[] = [
  { href: "/dashboard/overview", label: "Dashboard", icon: Home },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/selections", label: "Selections", icon: Package },
  { href: "/dashboard/jobs", label: "Jobs", icon: HardHat },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/communications?panel=dialer", label: "Call", icon: Phone },
  { href: "/dashboard/communications?panel=email", label: "Email", icon: Mail },
  { href: "/dashboard/recording-studio", label: "Record", icon: Mic },
  { href: "/dashboard/jobs?capture=photo", label: "Camera", icon: Camera },
  { href: "/dashboard/business-cards", label: "Cards", icon: IdCard },
  { href: "/dashboard/agent", label: "Bolt", icon: Sparkles },
];

const STORAGE_KEY = "cmi_mobilenav_closed";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    // eslint-disable-next-line -- one-time restore of the dismissed state on mount
    if (localStorage.getItem(STORAGE_KEY) === "1") setOpen(false);
  }, []);

  function setOpenPersist(v: boolean) {
    setOpen(v);
    localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
  }

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base !== "/" && pathname.startsWith(base);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenPersist(true)}
        className="fixed bottom-4 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg lg:hidden print:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <ChevronUp className="h-4 w-4" /> Menu
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden print:hidden">
      <div className="flex items-stretch border-t border-border bg-card/95 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((it) => {
            const active = isActive(it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                href={it.href}
                className={cn(
                  "flex min-w-[60px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition",
                  active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setOpenPersist(false)}
          aria-label="Hide menu"
          className="flex shrink-0 items-center border-l border-border px-3 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* iOS home-indicator safe area */}
      <div className="bg-card/95" style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
