import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob } from "@/lib/jobs/data";
import { JobDetailNav } from "../job-detail-nav";
import { PunchListPanel } from "@/components/punch/punch-list-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Punch List — CMI Dashboard" };

export default async function JobPunchListPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="punch-list" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div>
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <div className="mt-2">
            <PunchListPanel parentType="job" parentId={job.id} parentLabel={job.job_name} />
          </div>
        </div>
      </div>
    </div>
  );
}
