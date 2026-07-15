"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ArrowLeft, BookOpen, BriefcaseBusiness, CalendarRange,
  CreditCard, FileText, FolderKanban, HardHat, Home, IdCard, LayoutGrid,
  MessageCircle, Mic, Minus, Newspaper, Package, Plus, Settings, ShieldCheck,
  Sparkles, User, UserRoundCog, Users,
} from "lucide-react";

export type UserRole =
  | "super_admin" | "admin" | "project_manager" | "staff"
  | "designer" | "estimator" | "superintendent"
  | "subcontractor" | "vendor" | "client" | "viewer";

type IconType = typeof FolderKanban;

// A nested child link that lives inside a parent's dropdown.
type NavChild = { href: string; label: string; icon: IconType; roles?: UserRole[] };

type NavItem =
  | { href: string; label: string; icon: IconType; roles?: UserRole[]; children?: NavChild[]; section?: never }
  | { section: string; roles?: UserRole[]; label?: never; icon?: never; href?: never };

// roles: undefined = visible to all; defined array = visible only to those roles.
// A parent item keeps its own `href` (clicking the label navigates there) and an
// optional `children` list that expands/collapses via the +/- toggle.
const nav: NavItem[] = [
  { href: "/dashboard/overview",       label: "Overview",       icon: Home },
  { href: "/dashboard/contacts",       label: "Contacts",       icon: Users,          roles: ["super_admin", "admin", "project_manager", "estimator"] },
  { href: "/dashboard/project-manager",label: "Projects",       icon: FolderKanban,   roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "subcontractor", "client"] },
  { href: "/dashboard/selections",     label: "Selections",     icon: Package,        roles: ["super_admin", "admin", "project_manager", "designer", "client"] },
  { href: "/dashboard/sales",          label: "Pre-Con",        icon: BriefcaseBusiness, roles: ["super_admin", "admin", "project_manager", "estimator"] },
  {
    href: "/dashboard/jobs",           label: "Jobs",           icon: HardHat,        roles: ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer"],
    children: [
      { href: "/dashboard/jobs/map",               label: "Jobs Map",         icon: LayoutGrid, roles: ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer"] },
      { href: "/dashboard/jobs/new-from-template",  label: "Templates",        icon: FileText,   roles: ["super_admin", "admin", "project_manager"] },
      { href: "/dashboard/client-engagement",       label: "Client Engagement", icon: Users,     roles: ["super_admin", "admin", "project_manager"] },
    ],
  },
  { href: "/dashboard/billing",        label: "Billing",        icon: CreditCard,     roles: ["super_admin", "admin", "estimator", "client"] },
  { href: "/dashboard/bookings",       label: "Bookings",       icon: CalendarRange,  roles: ["super_admin", "admin", "project_manager", "estimator", "client"] },
  {
    href: "/dashboard/communications", label: "Communications", icon: MessageCircle,  roles: ["super_admin", "admin", "project_manager", "estimator"],
    children: [
      { href: "/dashboard/business-cards",   label: "Business Cards",   icon: IdCard, roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff"] },
      { href: "/dashboard/recording-studio", label: "Recording Studio", icon: Mic,    roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff"] },
    ],
  },
  { href: "/dashboard/documents",      label: "Documents",      icon: FileText },
  {
    href: "/dashboard/site-content",   label: "Site Content",   icon: BookOpen,       roles: ["super_admin", "admin", "designer"],
    children: [
      { href: "/dashboard/portfolio",         label: "Portfolio",         icon: LayoutGrid,  roles: ["super_admin", "admin", "designer"] },
      { href: "/dashboard/team",              label: "Team",              icon: Users,       roles: ["super_admin", "admin"] },
      { href: "/dashboard/blog",              label: "Blog",              icon: Newspaper,   roles: ["super_admin", "admin", "designer"] },
      { href: "/dashboard/messaging-consent", label: "Messaging Consent", icon: ShieldCheck, roles: ["super_admin", "admin"] },
    ],
  },
  { href: "/dashboard/agent",          label: "Bolt AI Agent",  icon: Sparkles,       roles: ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent"] },

  // ── Account / administration ──
  { section: "Account" },
  { href: "/dashboard/users",          label: "User Management", icon: UserRoundCog,  roles: ["super_admin", "admin"] },
  { href: "/dashboard/my-profile",     label: "My Profile",     icon: User },
  { href: "/dashboard/settings",       label: "Settings",       icon: Settings,       roles: ["super_admin", "admin"] },
  { href: "/",                         label: "Back to Site",   icon: ArrowLeft },
];

function canSeeRoles(roles: UserRole[] | undefined, role: UserRole): boolean {
  return !roles || roles.includes(role);
}
function canSee(item: NavItem, role: UserRole): boolean {
  return canSeeRoles("roles" in item ? item.roles : undefined, role);
}

export function DashboardNav({ collapsed = false, role = "viewer" }: { collapsed?: boolean; role?: UserRole }) {
  const pathname = usePathname();

  const isActive = (href: string) => href !== "/" && pathname.startsWith(href);

  // Which parent group contains the current route (used to auto-expand it).
  const activeParent = React.useMemo(() => {
    for (const item of nav) {
      if ("children" in item && item.children) {
        if (isActive(item.href) || item.children.some((c) => isActive(c.href))) return item.href;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Manually-toggled groups persist across route changes (the nav stays mounted
  // in the layout). The group holding the current page is always treated as open
  // (unioned at render), so no effect is needed to keep it expanded.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggle(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  }

  const leafClass = (active: boolean, indent = false) =>
    `flex w-full items-center rounded-md py-2 text-left text-[13px] font-medium transition ${collapsed ? "justify-center px-2" : `gap-3 ${indent ? "pl-9 pr-3" : "px-3"}`} ${
      active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  function LeafLink({ href, label, icon: Icon, indent }: { href: string; label: string; icon: IconType; indent?: boolean }) {
    const link = (
      <Link href={href} className={leafClass(isActive(href), indent)}>
        <Icon className="h-3.5 w-3.5" />
        {!collapsed ? label : null}
      </Link>
    );
    return collapsed ? <Tooltip label={label} side="right">{link}</Tooltip> : link;
  }

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
      {nav.map((item, i) => {
        if ("section" in item) {
          if (!canSee(item, role)) return null;
          return <div key={`section-${i}`} className={`mt-5 border-t border-border pt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${collapsed ? "mx-2 px-0" : "px-3"}`} />;
        }

        // ── Parent with nested children ──
        if ("children" in item && item.children) {
          const visibleChildren = item.children.filter((c) => canSeeRoles(c.roles, role));
          const parentVisible = canSee(item, role);
          if (!parentVisible && visibleChildren.length === 0) return null;

          // Collapsed sidebar is icon-only: flatten the group to icon links so
          // nested items stay reachable without an expand affordance.
          if (collapsed) {
            return (
              <React.Fragment key={item.href}>
                {parentVisible && <LeafLink href={item.href} label={item.label} icon={item.icon} />}
                {visibleChildren.map((c) => <LeafLink key={c.href} href={c.href} label={c.label} icon={c.icon} />)}
              </React.Fragment>
            );
          }

          const open = expanded.has(item.href) || item.href === activeParent;
          const parentActive = isActive(item.href);
          const rowClass = `flex items-center rounded-md text-[13px] font-medium transition ${
            parentActive ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`;

          return (
            <div key={item.href}>
              <div className={rowClass}>
                {/* Label → navigate to the parent's own page (when permitted). */}
                {parentVisible ? (
                  <Link href={item.href} className="flex flex-1 items-center gap-3 py-2 pl-3">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                ) : (
                  <button type="button" onClick={() => toggle(item.href)} className="flex flex-1 items-center gap-3 py-2 pl-3 text-left">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                )}
                {/* +/- → expand or collapse the nested items. */}
                {visibleChildren.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(item.href)}
                    aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    aria-expanded={open}
                    className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {open && (
                <div className="mt-1 space-y-1">
                  {visibleChildren.map((c) => <LeafLink key={c.href} href={c.href} label={c.label} icon={c.icon} indent />)}
                </div>
              )}
            </div>
          );
        }

        // ── Regular leaf item ──
        if (!canSee(item, role)) return null;
        return <LeafLink key={item.href} href={item.href} label={item.label} icon={item.icon} />;
      })}
    </nav>
  );
}
