import { getSupabaseAdmin } from "@/lib/supabase/server";

export type OverviewStats = {
  contacts: number;
  projects: number;
  portfolio: number;
  bookings: number;
  quotes: number;
  leads: number;
  blogPosts: number;
  teamMembers: number;
  documents: number;
  contracts: number;
  sows: number;
  activeStaff: number;
};

export type RecentItem = {
  id: string;
  label: string;
  sub: string;
  type: string;
  at: string;
};

export type UpcomingAppointment = {
  id: string;
  title: string;
  customerName: string;
  startTime: string;
  locationType: string;
  status: string;
};

export type OverviewData = {
  stats: OverviewStats;
  recent: RecentItem[];
  upcoming: UpcomingAppointment[];
};

async function safeCount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  filter?: { column: string; value: string }
): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadOverviewData(): Promise<OverviewData> {
  const supabase = getSupabaseAdmin();

  const [
    contacts,
    projects,
    portfolio,
    bookings,
    quotes,
    leads,
    blogPosts,
    teamMembers,
    documents,
    contracts,
    sows,
    activeStaff,
  ] = await Promise.all([
    safeCount(supabase, "contacts"),
    safeCount(supabase, "project_schedule_items"),
    safeCount(supabase, "portfolio"),
    safeCount(supabase, "booking_appointments"),
    safeCount(supabase, "quotes", { column: "status", value: "Quoted" }),
    safeCount(supabase, "quotes", { column: "status", value: "New" }),
    safeCount(supabase, "blog_posts"),
    safeCount(supabase, "team_members"),
    safeCount(supabase, "documents"),
    safeCount(supabase, "documents", { column: "type", value: "contract" }),
    safeCount(supabase, "documents", { column: "type", value: "sow" }),
    safeCount(supabase, "staff_users", { column: "status", value: "active" }),
  ]);

  // Recent activity: pull last 3 from several tables, merge, sort, take 8
  const recentResults = await Promise.allSettled([
    supabase.from("contacts").select("id,first_name,last_name,email,updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("quotes").select("id,name,status,updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("booking_appointments").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("documents").select("id,title,type,updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("blog_posts").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(2),
  ]);

  const recent: RecentItem[] = [];

  const [rContacts, rQuotes, rBookings, rDocs, rBlog] = recentResults;

  if (rContacts.status === "fulfilled" && rContacts.value.data) {
    for (const c of rContacts.value.data) {
      recent.push({ id: c.id, label: `${c.first_name} ${c.last_name}`.trim() || c.email, sub: c.email, type: "Contact", at: c.updated_at });
    }
  }
  if (rQuotes.status === "fulfilled" && rQuotes.value.data) {
    for (const q of rQuotes.value.data) {
      recent.push({ id: q.id, label: q.name, sub: q.status, type: "Quote", at: q.updated_at });
    }
  }
  if (rBookings.status === "fulfilled" && rBookings.value.data) {
    for (const b of rBookings.value.data) {
      recent.push({ id: b.id, label: b.title, sub: b.status, type: "Booking", at: b.updated_at });
    }
  }
  if (rDocs.status === "fulfilled" && rDocs.value.data) {
    for (const d of rDocs.value.data) {
      recent.push({ id: d.id, label: d.title, sub: d.type.toUpperCase(), type: "Document", at: d.updated_at });
    }
  }
  if (rBlog.status === "fulfilled" && rBlog.value.data) {
    for (const p of rBlog.value.data) {
      recent.push({ id: p.id, label: p.title, sub: p.status, type: "Blog", at: p.updated_at });
    }
  }

  recent.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Upcoming appointments (next 5)
  const upcoming: UpcomingAppointment[] = [];
  try {
    const { data } = await supabase
      .from("booking_appointments")
      .select("id,title,customer_first_name,customer_last_name,start_time,location_type,status")
      .gte("start_time", new Date().toISOString())
      .in("status", ["pending", "confirmed", "awaiting_client"])
      .order("start_time", { ascending: true })
      .limit(5);

    for (const a of data ?? []) {
      upcoming.push({
        id: a.id,
        title: a.title,
        customerName: [a.customer_first_name, a.customer_last_name].filter(Boolean).join(" ") || "—",
        startTime: a.start_time,
        locationType: a.location_type,
        status: a.status,
      });
    }
  } catch {
    // table may be empty
  }

  return {
    stats: { contacts, projects, portfolio, bookings, quotes, leads, blogPosts, teamMembers, documents, contracts, sows, activeStaff },
    recent: recent.slice(0, 8),
    upcoming,
  };
}

export function getDemoOverviewData(): OverviewData {
  return {
    stats: { contacts: 48, projects: 23, portfolio: 11, bookings: 7, quotes: 5, leads: 12, blogPosts: 8, teamMembers: 6, documents: 14, contracts: 9, sows: 5, activeStaff: 4 },
    recent: [
      { id: "1", label: "Brandon Fadden", sub: "brandon@constructedmatter.com", type: "Contact", at: new Date().toISOString() },
      { id: "2", label: "Kitchen Remodel — Smith Residence", sub: "New", type: "Quote", at: new Date(Date.now() - 3600000).toISOString() },
      { id: "3", label: "Discovery Call — Johnson", sub: "confirmed", type: "Booking", at: new Date(Date.now() - 7200000).toISOString() },
      { id: "4", label: "Smith Residence Contract", sub: "CONTRACT", type: "Document", at: new Date(Date.now() - 86400000).toISOString() },
      { id: "5", label: "ADU 101: What You Need to Know", sub: "published", type: "Blog", at: new Date(Date.now() - 172800000).toISOString() },
    ],
    upcoming: [
      { id: "1", title: "Discovery Call", customerName: "Maria Johnson", startTime: new Date(Date.now() + 86400000).toISOString(), locationType: "phone_call", status: "confirmed" },
      { id: "2", title: "Site Visit", customerName: "Robert Chen", startTime: new Date(Date.now() + 172800000).toISOString(), locationType: "onsite", status: "pending" },
    ],
  };
}
