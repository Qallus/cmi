import "leaflet/dist/leaflet.css";
import { loadJobList } from "@/lib/jobs/data";
import type { JobListRow } from "@/lib/jobs/data";
import { JobsMapClient } from "./jobs-map-client";

export const metadata = { title: "Jobs Map — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobsMapPage() {
  let rows: JobListRow[] = [];
  try {
    rows = await loadJobList();
  } catch {
    // empty fallback
  }
  return <JobsMapClient rows={rows} />;
}
