import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadBoard } from "@/lib/projections/data";
import { ProjectionsClient } from "./projections-client";

export const metadata = { title: "Projections — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Admin / Super Admin only, behind the `projections` flag. Anyone else gets a
// 404 so the page's existence isn't advertised.
export default async function ProjectionsPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseProjections(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(PROJECTIONS_FLAG))) notFound();
  const board = await loadBoard();
  return <ProjectionsClient initialBoard={board} />;
}
