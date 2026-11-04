import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { listPhotos, photoFacets, FIELD_REPORTS_FLAG } from "@/lib/photos/data";
import { isFeatureEnabled } from "@/lib/flags";
import { getSessionStaff } from "@/lib/auth/server-session";
import { JobModuleShell } from "../job-module-shell";
import { PhotosClient } from "./photos-client";

export const metadata = { title: "Photos — CMI Dashboard" };
export const dynamic = "force-dynamic";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent", "designer"];

export default async function PhotosPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  if (!(await isFeatureEnabled(FIELD_REPORTS_FLAG))) {
    return (
      <JobModuleShell jobId={jobId} jobName={job.job_name} active="photos" title="Photos">
        <p className="text-sm text-muted-foreground">The Photos library is part of Field Reports, which isn&apos;t switched on yet (Settings → Features → field_reports).</p>
      </JobModuleShell>
    );
  }
  const [photos, facets, staff] = await Promise.all([listPhotos(jobId), photoFacets(jobId), getSessionStaff()]);
  return (
    <JobModuleShell jobId={jobId} jobName={job.job_name} active="photos" title="Photos">
      <PhotosClient jobId={jobId} jobName={job.job_name} initial={photos} initialFacets={facets} canEdit={WRITE_ROLES.includes(staff?.role_slug ?? "")} />
    </JobModuleShell>
  );
}
