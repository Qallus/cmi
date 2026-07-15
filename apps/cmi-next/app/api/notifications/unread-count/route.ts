import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const isAdmin = ["super_admin", "admin"].includes(staff.role_slug);

    // New business-card lead submissions: admins see all; other staff see
    // only leads captured on their own cards.
    let leadsQuery = supabase
      .from("business_card_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .is("notification_read_at", null);
    if (!isAdmin) leadsQuery = leadsQuery.eq("owner_staff_id", staff.id);

    // Dashboard notes shared with this user that they haven't read yet.
    const email = user.email ?? "";
    const sharedNotesReq = email
      ? supabase.from("dashboard_notes").select("read_by")
          .contains("recipient_emails", [email.toLowerCase()])
          .neq("status", "archived")
      : Promise.resolve({ data: [] as { read_by: string[] }[] });

    // Count new contact form submissions + unread messages + new card leads + new bookings.
    const [submissionsRes, messagesRes, leadsRes, sharedNotesRes, bookingsRes] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("status", "received")
        .is("notification_read_at", null),
      leadsQuery,
      sharedNotesReq,
      supabase
        .from("booking_appointments")
        .select("id", { count: "exact", head: true })
        .is("notification_read_at", null)
        .neq("status", "canceled"),
    ]);

    const unreadShared = ((sharedNotesRes.data as { read_by: string[] }[] | null) ?? [])
      .filter((r) => !(r.read_by ?? []).map((e) => e.toLowerCase()).includes(email.toLowerCase())).length;

    const count = (submissionsRes.count ?? 0) + (messagesRes.count ?? 0) + (leadsRes.count ?? 0) + unreadShared + (bookingsRes.count ?? 0);
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ count: 0 }, { status: error.status });
    return NextResponse.json({ count: 0 });
  }
}
