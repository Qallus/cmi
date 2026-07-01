import { redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { ReviewsClient } from "./reviews-client";

export const metadata = { title: "Saved Reviews — Live Page Editor" };
export const dynamic = "force-dynamic";

export default async function ReviewsGalleryPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login?redirectTo=/dashboard/site-content/live-editor/reviews");
  if (staff.role_slug !== "super_admin") redirect("/dashboard/site-content");
  return <ReviewsClient />;
}
