"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft, Bell, BookOpen, BriefcaseBusiness, CalendarRange,
  CreditCard, FileText, FolderKanban, Home, LayoutGrid,
  MessageCircle, Newspaper, Package, Settings, Sparkles,
  User, UserRoundCog, Users,
} from "lucide-react";

type NavItem =
  | { href: string; label: string; icon: typeof FolderKanban; section?: never }
  | { section: string; label?: never; icon?: never; href?: never };

const nav: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: Home },
  { href: "/dashboard/my-profile", label: "My Profile", icon: User },
  { href: "/dashboard/users", label: "Users", icon: UserRoundCog },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/project-manager", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/selections", label: "Selections", icon: Package },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/communications", label: "Communications", icon: MessageCircle },
  { href: "/dashboard/quotes-leads", label: "Quotes & Leads", icon: BriefcaseBusiness },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: LayoutGrid },
  { href: "/dashboard/blog", label: "Blog", icon: Newspaper },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/site-content", label: "Site Content", icon: BookOpen },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/agent", label: "Agent", icon: Sparkles },
  { section: "Settings" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/", label: "Back to Site", icon: ArrowLeft },
];

export function DashboardNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-2"}`}>
      {nav.map((item) => {
        if ("section" in item) {
          return <div key={item.section} className={`mt-5 border-t border-border pt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${collapsed ? "mx-2 px-0" : "px-3"}`} />;
        }
        const active = item.href !== "/" && pathname.startsWith(item.href);
        const className = `flex w-full items-center rounded-md py-2 text-left text-[13px] font-medium transition ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${
          active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`;
        return (
          <Link key={item.href} href={item.href} className={className} title={collapsed ? item.label : undefined}>
            <item.icon className="h-3.5 w-3.5" />
            {!collapsed ? item.label : null}
          </Link>
        );
      })}
    </nav>
  );
}
