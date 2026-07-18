import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/auth";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { ClientShell } from "@/app/client/jobs/client-shell";
import { CanvasList } from "@/components/features/project-canvas/canvas-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Canvas — Constructed Matter" };

export default async function ClientCanvasPage() {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  return (
    <ClientShell>
      <CanvasList surface="client" basePath="/client/canvas" />
    </ClientShell>
  );
}
