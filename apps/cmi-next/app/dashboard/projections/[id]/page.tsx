import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadDetail } from "@/lib/projections/data";
import { ProjectionFullView } from "./projection-full-view";

export const metadata = { title: "Projection — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Full projection view. Same gate as the Projections page: Admin / Super Admin
// with the flag on; anyone else gets a 404.
export default async function ProjectionPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseProjections(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(PROJECTIONS_FLAG))) notFound();
  const { id } = await params;
  const detail = await loadDetail(id).catch(() => null);
  if (!detail) notFound();
  return <ProjectionFullView initialRow={detail.row} isSuperAdmin={staff.role_slug === "super_admin"} />;
}
