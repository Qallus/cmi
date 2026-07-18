import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "@/lib/canvas/types";
import { BriefList } from "@/components/features/project-canvas/brief-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Canvas Briefs — CMI Dashboard" };

export default async function CanvasBriefsPage() {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS))) notFound();
  return <BriefList />;
}
