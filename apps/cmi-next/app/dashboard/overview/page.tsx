import { loadOverviewData } from "@/lib/overview/data";
import { OverviewClient } from "./overview-client";

export const metadata = { title: "Overview — CMI Dashboard" };

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await loadOverviewData();
  return <OverviewClient data={data} demoMode={false} />;
}
