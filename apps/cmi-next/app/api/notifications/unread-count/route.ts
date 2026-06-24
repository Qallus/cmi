import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const isAdmin = ["super_admin", "admin"].includes(staff.role_slug);

    // New business-card lead submissions: admins see all; other staff see
    // only leads captured on their own cards.
    let leadsQuery = supabase
      .from("business_card_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    if (!isAdmin) leadsQuery = leadsQuery.eq("owner_staff_id", staff.id);

    // Count new contact form submissions + unread messages + new card leads.
    const [submissionsRes, messagesRes, leadsRes] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("status", "received"),
      leadsQuery,
    ]);

    const count = (submissionsRes.count ?? 0) + (messagesRes.count ?? 0) + (leadsRes.count ?? 0);
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ count: 0 }, { status: error.status });
    return NextResponse.json({ count: 0 });
  }
}
