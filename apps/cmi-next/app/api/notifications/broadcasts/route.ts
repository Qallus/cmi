// Super-Admin broadcast notifications. POST creates + delivers a broadcast
// (staff bell via aggregation, staff web push, client in-app fan-out). GET lists
// recently sent broadcasts. Super Admin only.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createBroadcast, fanOutToClients, listBroadcasts, staffPushRecipients, type BroadcastAudience } from "@/lib/broadcasts/data";
import { sendPushToStaff } from "@/lib/push/web-push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (staff.role_slug !== "super_admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json({ broadcasts: await listBroadcasts() });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (staff.role_slug !== "super_admin") return NextResponse.json({ error: "Only Super Admins can send broadcasts." }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { title?: string; body?: string; link?: string; audience?: BroadcastAudience; target_role?: string };
    const { data: me } = await getSupabaseAdmin().from("staff_users").select("display_name, email").eq("id", staff.id).maybeSingle();
    const createdByName = me?.display_name || me?.email || user.email || "Super Admin";

    const broadcast = await createBroadcast({
      title: body.title ?? "", body: body.body ?? "", link: body.link ?? null,
      audience: body.audience ?? "all", target_role: body.target_role ?? null,
      createdByStaffId: staff.id, createdByName,
    });

    // Deliver: staff web push + client in-app fan-out (best-effort).
    const staffIds = await staffPushRecipients(broadcast).catch(() => [] as string[]);
    const [pushedStaff, clientCount] = await Promise.all([
      staffIds.length
        ? sendPushToStaff(staffIds, { title: broadcast.title, body: broadcast.body, url: broadcast.link || "/dashboard/overview", tag: `broadcast-${broadcast.id}` }).then(() => staffIds.length).catch(() => 0)
        : Promise.resolve(0),
      fanOutToClients(broadcast).catch(() => 0),
    ]);

    return NextResponse.json({ broadcast, delivered: { staffPush: pushedStaff, clients: clientCount } }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send broadcast." }, { status: 500 });
  }
}
