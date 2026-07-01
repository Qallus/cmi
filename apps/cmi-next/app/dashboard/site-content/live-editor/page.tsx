import { redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { PREVIEW_PAGES } from "@/lib/live-editor/pages";
import { LiveEditorClient } from "./live-editor-client";

export const metadata = { title: "Live Page Editor — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function LiveEditorPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  // Server-side guard: Super Admin only. Non-super-admins are bounced back to
  // Site Content (the button is also hidden from them client-side).
  const staff = await getSessionStaff();
  if (!staff) redirect("/login?redirectTo=/dashboard/site-content/live-editor");
  if (staff.role_slug !== "super_admin") redirect("/dashboard/site-content");

  const { page } = await searchParams;
  const initialSlug = PREVIEW_PAGES.some((p) => p.slug === page) ? page! : PREVIEW_PAGES[0]?.slug;

  return (
    <LiveEditorClient
      pages={PREVIEW_PAGES}
      reviewer={staff.display_name ?? staff.email}
      initialSlug={initialSlug}
    />
  );
}
