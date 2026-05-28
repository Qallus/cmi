import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarRange,
  CreditCard,
  FileText,
  FolderKanban,
  Home,
  LayoutGrid,
  MessageCircle,
  Newspaper,
  Package,
  Search,
  Settings,
  Sparkles,
  User,
  UserRoundCog,
  Users
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

type NavItem =
  | { href: string; label: string; icon: typeof FolderKanban; active?: boolean; section?: never }
  | { href?: never; label: string; icon: typeof FolderKanban; active?: boolean; section?: never }
  | { section: string; label?: never; icon?: never; href?: never; active?: never };

const nav: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: Home, active: false },
  { href: "/dashboard/my-profile", label: "My Profile", icon: User },
  { href: "/dashboard/users", label: "Users", icon: UserRoundCog },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/project-manager", label: "Projects", icon: FolderKanban, active: true },
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
  { href: "/", label: "Back to Site", icon: ArrowLeft }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-[88px] items-center border-b border-border px-4">
          <div>
            <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="h-8 w-auto object-contain dark:hidden" />
            <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="hidden h-8 w-auto object-contain dark:block" />
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Team Dashboard</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {nav.map(item => {
            if ("section" in item) {
              return <div key={item.section} className="mt-5 border-t border-border px-3 pt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground" />;
            }
            const className = `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] font-medium transition ${
              item.active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`;
            const content = (
              <>
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </>
            );
            const key = item.href || item.label;
            return item.href ? (
              <Link key={key} href={item.href} className={className}>
                {content}
              </Link>
            ) : (
              <button key={key} type="button" className={className} disabled title="Planned migration page">
                {content}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-1 py-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">JW</div>
              <div>
                <div className="text-xs font-semibold">Jeremy Waters</div>
                <div className="text-[11px] text-muted-foreground">Web Master</div>
              </div>
            </div>
            <button className="rounded-md border border-border p-1.5 text-muted-foreground" type="button" title="Sign out">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/92 px-5 backdrop-blur">
          <div className="text-sm font-semibold">Projects</div>
          <div className="flex items-center gap-2">
            <div className="hidden h-8 w-44 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground md:flex">
              <Search className="h-3.5 w-3.5" />
              Search
            </div>
            <ThemeToggle />
            <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground" type="button" title="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
          </div>
        </header>
        <div className="min-h-[calc(100vh-56px)]">{children}</div>
      </main>
    </div>
  );
}
