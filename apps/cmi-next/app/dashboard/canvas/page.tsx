import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { CanvasList } from "@/components/features/project-canvas/canvas-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Canvas — CMI Dashboard" };

export default async function DashboardCanvasPage() {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  return <CanvasList surface="staff" basePath="/dashboard/canvas" />;
}
