import { loadOverviewData, getDemoOverviewData } from "@/lib/overview/data";
import { OverviewClient } from "./overview-client";

export const metadata = { title: "Overview — CMI Dashboard" };

export default async function OverviewPage() {
  try {
    const data = await loadOverviewData();
    return <OverviewClient data={data} demoMode={false} />;
  } catch {
    return <OverviewClient data={getDemoOverviewData()} demoMode={true} />;
  }
}
