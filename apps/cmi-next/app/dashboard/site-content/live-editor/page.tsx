import { redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { PREVIEW_PAGES } from "@/lib/live-editor/pages";
import { LiveEditorClient } from "./live-editor-client";

export const metadata = { title: "Live Page Editor — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function LiveEditorPage() {
  // Server-side guard: Super Admin only. Non-super-admins are bounced back to
  // Site Content (the button is also hidden from them client-side).
  const staff = await getSessionStaff();
  if (!staff) redirect("/login?redirectTo=/dashboard/site-content/live-editor");
  if (staff.role_slug !== "super_admin") redirect("/dashboard/site-content");

  return (
    <LiveEditorClient
      pages={PREVIEW_PAGES}
      reviewer={staff.display_name ?? staff.email}
    />
  );
}
