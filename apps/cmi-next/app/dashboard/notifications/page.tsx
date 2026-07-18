import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — CMI Dashboard" };

async function isSuperAdmin(): Promise<boolean> {
  const token = (await cookies()).get("cmi-session")?.value;
  if (!token) return false;
  const sb = getSupabaseAdmin();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user?.email) return false;
  const { data } = await sb.from("staff_users").select("role_slug").eq("email", user.email).maybeSingle();
  return data?.role_slug === "super_admin";
}

export default async function NotificationsPage() {
  if (!(await isSuperAdmin())) notFound();
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Super Admin</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Broadcast an announcement to everyone, all staff, all clients, or a specific role. Delivered to the in-app bell and web push; recipients who opted out are skipped.</p>
      </div>
      <NotificationsClient />
    </div>
  );
}
