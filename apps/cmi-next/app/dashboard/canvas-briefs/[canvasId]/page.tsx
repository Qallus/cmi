import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { BriefDetail } from "@/components/features/project-canvas/brief-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Canvas Brief — CMI Dashboard" };

export default async function CanvasBriefDetailPage({ params }: { params: Promise<{ canvasId: string }> }) {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  const { canvasId } = await params;
  return <BriefDetail canvasId={canvasId} />;
}
