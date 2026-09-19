import "leaflet/dist/leaflet.css";
import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadBoard, loadSettings } from "@/lib/projections/data";
import { ProjectionsClient } from "./projections-client";

export const metadata = { title: "Projections — CMI Dashboard" };
export const dynamic = "force-dynamic";

type Search = Promise<{ open?: string; add_deal?: string; add_opportunity?: string }>;

// Admin / Super Admin only, behind the `projections` flag. Anyone else gets a
// 404 so the page's existence isn't advertised. Deep links: ?open=<projection>,
// ?add_deal=<deal>, ?add_opportunity=<opportunity>.
export default async function ProjectionsPage({ searchParams }: { searchParams: Search }) {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseProjections(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(PROJECTIONS_FLAG))) notFound();
  const [board, settings, q] = await Promise.all([loadBoard(), loadSettings(), searchParams]);
  return (
    <ProjectionsClient
      initialBoard={board}
      initialSettings={settings}
      initialAction={{ open: q.open ?? null, addDeal: q.add_deal ?? null, addOpportunity: q.add_opportunity ?? null }}
      isSuperAdmin={staff.role_slug === "super_admin"}
    />
  );
}
