import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/auth";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { CanvasEditor } from "@/components/features/project-canvas/canvas-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Canvas — Constructed Matter" };

export default async function ClientCanvasEditorPage({ params }: { params: Promise<{ canvasId: string }> }) {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const { canvasId } = await params;
  return <CanvasEditor canvasId={canvasId} surface="client" backHref="/client/canvas" />;
}
