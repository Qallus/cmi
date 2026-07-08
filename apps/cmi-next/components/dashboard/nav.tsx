"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ArrowLeft, BookOpen, BriefcaseBusiness, CalendarRange,
  CreditCard, FileText, FolderKanban, Home, IdCard, LayoutGrid,
  MessageCircle, Mic, Newspaper, Package, Settings, ShieldCheck, Sparkles,
  User, UserRoundCog, Users,
} from "lucide-react";

export type UserRole =
  | "super_admin" | "admin" | "project_manager" | "staff"
  | "designer" | "estimator" | "superintendent"
  | "subcontractor" | "vendor" | "client" | "viewer";

type NavItem =
  | { href: string; label: string; icon: typeof FolderKanban; roles?: UserRole[]; section?: never }
  | { section: string; roles?: UserRole[]; label?: never; icon?: never; href?: never };

// roles: undefined = visible to all; defined array = visible only to those roles
const nav: NavItem[] = [
  { href: "/dashboard/overview",       label: "Overview",       icon: Home },
  { href: "/dashboard/my-profile",     label: "My Profile",     icon: User },
  { href: "/dashboard/users",          label: "Users",          icon: UserRoundCog,   roles: ["super_admin", "admin"] },
  { href: "/dashboard/contacts",       label: "Contacts",       icon: Users,          roles: ["super_admin", "admin", "project_manager", "estimator"] },
  { href: "/dashboard/project-manager",label: "Projects",       icon: FolderKanban,   roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "subcontractor", "client"] },
  { href: "/dashboard/selections",     label: "Selections",     icon: Package,        roles: ["super_admin", "admin", "project_manager", "designer", "client"] },
  { href: "/dashboard/bookings",       label: "Bookings",       icon: CalendarRange,  roles: ["super_admin", "admin", "project_manager", "estimator", "client"] },
  { href: "/dashboard/billing",        label: "Billing",        icon: CreditCard,     roles: ["super_admin", "admin", "estimator", "client"] },
  { href: "/dashboard/communications", label: "Communications", icon: MessageCircle,  roles: ["super_admin", "admin", "project_manager", "estimator"] },
  { href: "/dashboard/recording-studio", label: "Recording Studio", icon: Mic,        roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff"] },
  { href: "/dashboard/sales",          label: "Sales",          icon: BriefcaseBusiness, roles: ["super_admin", "admin", "project_manager", "estimator"] },
  { href: "/dashboard/messaging-consent", label: "Messaging Consent", icon: ShieldCheck, roles: ["super_admin", "admin"] },
  { href: "/dashboard/portfolio",      label: "Portfolio",      icon: LayoutGrid,     roles: ["super_admin", "admin", "designer"] },
  { href: "/dashboard/blog",           label: "Blog",           icon: Newspaper,      roles: ["super_admin", "admin", "designer"] },
  { href: "/dashboard/team",           label: "Team",           icon: Users,          roles: ["super_admin", "admin"] },
  { href: "/dashboard/business-cards", label: "Business Cards", icon: IdCard,         roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff"] },
  { href: "/dashboard/site-content",   label: "Site Content",   icon: BookOpen,       roles: ["super_admin", "admin", "designer"] },
  { href: "/dashboard/documents",      label: "Documents",      icon: FileText },
  { href: "/dashboard/agent",          label: "Agent",          icon: Sparkles,       roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent"] },
  { section: "Settings" },
  { href: "/dashboard/settings",       label: "Settings",       icon: Settings,       roles: ["super_admin", "admin"] },
  { href: "/",                         label: "Back to Site",   icon: ArrowLeft },
];

function canSee(item: NavItem, role: UserRole): boolean {
  if (!("roles" in item) || !item.roles) return true;
  return item.roles.includes(role);
}

export function DashboardNav({ collapsed = false, role = "viewer" }: { collapsed?: boolean; role?: UserRole }) {
  const pathname = usePathname();
  const visible = nav.filter(item => canSee(item, role));

  return (
    <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-2"}`}>
      {visible.map((item, i) => {
        if ("section" in item) {
          return <div key={`section-${i}`} className={`mt-5 border-t border-border pt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${collapsed ? "mx-2 px-0" : "px-3"}`} />;
        }
        const active = item.href !== "/" && pathname.startsWith(item.href);
        const className = `flex w-full items-center rounded-md py-2 text-left text-[13px] font-medium transition ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${
          active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`;
        const link = (
          <Link href={item.href} className={className}>
            <item.icon className="h-3.5 w-3.5" />
            {!collapsed ? item.label : null}
          </Link>
        );
        return collapsed
          ? <Tooltip key={item.href} label={item.label} side="right">{link}</Tooltip>
          : <React.Fragment key={item.href}>{link}</React.Fragment>;
      })}
    </nav>
  );
}
