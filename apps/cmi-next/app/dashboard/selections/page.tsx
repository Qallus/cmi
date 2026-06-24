import { loadSelectionsData } from "@/lib/selections/data";
import { getDemoSelectionsData } from "@/lib/selections/demo-data";
import { SelectionsClient } from "./selections-client";

export const dynamic = "force-dynamic";

export default async function SelectionsPage() {
  try {
    const data = await loadSelectionsData();
    return <SelectionsClient initialData={data} demoMode={false} />;
  } catch (error) {
    return <SelectionsClient initialData={getDemoSelectionsData()} demoMode={true} setupMessage={error instanceof Error ? error.message : "Selections are running in demo mode."} />;
  }
}
