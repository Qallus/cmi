import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();

    // Count new contact form submissions + unread messages in parallel
    const [submissionsRes, messagesRes] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("status", "received"),
    ]);

    const count = (submissionsRes.count ?? 0) + (messagesRes.count ?? 0);
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ count: 0 }, { status: error.status });
    return NextResponse.json({ count: 0 });
  }
}
