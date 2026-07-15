import { ArrowRight, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages: Record<string, { title: string; eyebrow: string; description: string; stats: string[] }> = {
  overview: {
    title: "Overview",
    eyebrow: "Team Dashboard",
    description: "Dashboard cards, recent activity, quick actions, upcoming items, and Bolt preview will migrate here after Project Manager is stable.",
    stats: ["Contacts", "Projects", "Quotes", "Documents"]
  },
  "my-profile": {
    title: "My Profile",
    eyebrow: "Staff Account",
    description: "Public team profile editing, staff account access, team link status, and profile photo controls.",
    stats: ["Public profile", "Team link", "Staff access", "Bio"]
  },
  users: {
    title: "Users",
    eyebrow: "Administration",
    description: "User access management, roles, invites, account status, and contact/project relationship controls.",
    stats: ["Active", "Invited", "Clients", "Vendors"]
  },
  contacts: {
    title: "Contacts",
    eyebrow: "FluentCRM",
    description: "Contact list filters, tags, lists, import/export, and contact detail drawers.",
    stats: ["Lists", "Tags", "Import", "Details"]
  },
  bookings: {
    title: "Bookings",
    eyebrow: "Schedule",
    description: "FluentBooking appointments, list/calendar views, event types, and appointment creation.",
    stats: ["Upcoming", "Completed", "Calendar", "Event types"]
  },
  selections: {
    title: "Selections",
    eyebrow: "Products",
    description: "Construction selections, vendors, pricing, images, delivery status, and project/task product assignments.",
    stats: ["Products", "Vendors", "Delivery", "Approvals"]
  },
  communications: {
    title: "Communications",
    eyebrow: "Client Relations",
    description: "SMS, email, inbox history, message threads, and delivery status tracking.",
    stats: ["Single SMS", "Bulk SMS", "Email", "Inbox"]
  },
  "quotes-leads": {
    title: "Pre-Construction",
    eyebrow: "Pre-Con",
    description: "Quote pipeline, lead status, project intake details, and conversion to projects.",
    stats: ["New", "In Review", "Quoted", "Won"]
  },
  portfolio: {
    title: "Portfolio",
    eyebrow: "Work",
    description: "Portfolio grid, categories, WordPress sync, featured images, and project publishing.",
    stats: ["Residential", "Commercial", "ADU", "Interior"]
  },
  blog: {
    title: "Blog",
    eyebrow: "Content",
    description: "Blog post list, editor flow, WordPress publishing, categories, and status controls.",
    stats: ["Drafts", "Published", "Categories", "Sync"]
  },
  team: {
    title: "Team",
    eyebrow: "People",
    description: "Team member cards, add/edit forms, hover photos, attributes, and staff-link status.",
    stats: ["Members", "Roles", "Photos", "Attributes"]
  },
  "site-content": {
    title: "Site Content",
    eyebrow: "Public Site",
    description: "Hero blocks, notices, CTAs, and page-specific public website content.",
    stats: ["Hero", "Notice", "CTA", "Pages"]
  },
  documents: {
    title: "Documents",
    eyebrow: "Legal",
    description: "Contracts, SOWs, document records, signature status, PDF/export flows, and email sends.",
    stats: ["Contracts", "SOW", "Drafts", "Signatures"]
  },
  agent: {
    title: "Agent",
    eyebrow: "Bolt",
    description: "Future OpenAI Realtime voice assistant prototype. This should stay read-only until the new app shell has auth and role context.",
    stats: ["Voice", "Read-only", "Approvals", "Project context"]
  },
  settings: {
    title: "Settings",
    eyebrow: "Admin",
    description: "Environment-backed settings, API connection status, webhook URLs, and secure integration configuration.",
    stats: ["API status", "Webhooks", "Roles", "Audit logs"]
  }
};

export default async function DashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = pages[section] || pages.overview;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{page.eyebrow}</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{page.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{page.description}</p>
        </div>
        <Button variant="outline" size="sm">
          Planned
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {page.stats.map(stat => (
          <Card key={stat}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{stat}</div>
              <div className="mt-3 text-2xl font-semibold">0</div>
              <div className="mt-2 text-xs text-muted-foreground">Migration placeholder</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-4 w-4 text-accent" />
            Page Shell Ready
          </CardTitle>
          <CardDescription>
            This route is intentionally scaffolded so navigation feels complete while we migrate one dashboard section at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Project Manager is the first functional page. {page.title} will be wired to live data after the dashboard shell and auth layer are finalized.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
