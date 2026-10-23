// Organize the Communications list: archive, restore or delete one or more
// logged messages. Archiving is open to all staff; deleting a message record
// is Super Admin / Admin only, because these rows are the outreach history.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStaffSession } from "@/lib/auth/guard";
import { AuthError } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

const DELETE_ROLES = ["super_admin", "admin"];

export async function POST(request: Request) {
  try {
    const { staff } = await getStaffSession();
    const { ids, action } = (await request.json()) as { ids?: unknown; action?: string };
    const list = Array.isArray(ids) ? ids.filter((v): v is string => typeof v === "string").slice(0, 500) : [];
    if (!list.length) return NextResponse.json({ error: "Choose at least one message." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (action === "archive" || action === "restore") {
      const patch = action === "archive"
        ? { archived_at: new Date().toISOString(), archived_by: staff.id }
        : { archived_at: null, archived_by: null };
      const { error } = await supabase.from("messages").update(patch).in("id", list);
      if (error) {
        if (/archived_at/.test(error.message)) return NextResponse.json({ error: "Archiving needs the 2026-10-23_messages_archive migration." }, { status: 503 });
        throw error;
      }
      return NextResponse.json({ ok: true, updated: list.length });
    }

    if (action === "delete") {
      if (!DELETE_ROLES.includes(staff.role_slug)) {
        return NextResponse.json({ error: "Only Super Admins and Admins can delete messages. Archive it instead." }, { status: 403 });
      }
      const { error } = await supabase.from("messages").delete().in("id", list);
      if (error) throw error;
      return NextResponse.json({ ok: true, deleted: list.length });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't update messages." }, { status: 500 });
  }
}
