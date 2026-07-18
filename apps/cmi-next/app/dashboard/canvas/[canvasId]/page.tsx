import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { CanvasEditor } from "@/components/features/project-canvas/canvas-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Canvas — CMI Dashboard" };

export default async function DashboardCanvasEditorPage({ params }: { params: Promise<{ canvasId: string }> }) {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  const { canvasId } = await params;
  return <CanvasEditor canvasId={canvasId} surface="staff" backHref="/dashboard/canvas" />;
}
