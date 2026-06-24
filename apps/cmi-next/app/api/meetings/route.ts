import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadMeetings, saveMeeting } from "@/lib/meetings/data";
import type { SaveMeetingPayload } from "@/lib/meetings/types";

const VIEW_ALL = ["super_admin", "admin", "project_manager"];

export async function GET(request: Request) {
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const url = new URL(request.url);
  const filters = {
    status: url.searchParams.get("status") || undefined,
    meeting_type: url.searchParams.get("type") || undefined,
    contact_id: url.searchParams.get("contact_id") || undefined,
    project_item_id: url.searchParams.get("project_item_id") || undefined,
    search: url.searchParams.get("search") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  };

  try {
    const meetings = await loadMeetings({ all: VIEW_ALL.includes(staff.role_slug), staffId: staff.id, filters });
    return NextResponse.json({ meetings, isAdmin: ["super_admin", "admin"].includes(staff.role_slug), staffId: staff.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load meetings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const payload = (await request.json().catch(() => null)) as SaveMeetingPayload | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  // Non-admins can only edit their own meetings.
  if (payload.id && !["super_admin", "admin"].includes(staff.role_slug)) {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await getSupabaseAdmin().from("meetings").select("created_by, staff_user_id").eq("id", payload.id).maybeSingle();
    if (!data || (data.created_by !== staff.id && data.staff_user_id !== staff.id)) {
      return NextResponse.json({ error: "You can only edit meetings you created or are assigned to." }, { status: 403 });
    }
  }

  try {
    const meeting = await saveMeeting(payload, staff.id);
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}
